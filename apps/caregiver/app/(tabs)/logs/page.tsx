'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  IconBox,
  PatientSwitcher,
  AudioBubble,
  TaskCard,
  ChatBubble,
  HoldToTalkBar,
  VisitReportDraft,
  PullUpSheet,
  EMPTY_DRAFT,
  type ReportDraft,
  type DraftField,
  type BarMode,
  IconSearch,
  IconHistory,
  IconSendMessage,
} from '@alio/ui';
import {
  INITIAL_CONVERSATION,
  SAMPLE_PATIENTS,
  type ConversationTurn,
} from '@alio/mock-data';
import { api, ApiError } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const CAREGIVER_ID = 'caregiver-001';

type View = 'voice-idle' | 'voice-recording' | 'voice-review';
type RecordState = 'idle' | 'recording' | 'saving';
type CompileState = 'idle' | 'compiling';

/** Pull vitals out of the caregiver's own words so the report card can fill in
 * before the server-side compile runs. Deliberately loose — a miss just leaves
 * the field waiting. */
function extractVitals(text: string): string | null {
  const parts: string[] = [];
  const bp = text.match(/(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})/i);
  if (bp) parts.push(`${bp[1]}/${bp[2]}`);
  const pulse = text.match(/(\d{2,3})\s*(?:bpm|beats)/i);
  if (pulse) parts.push(`${pulse[1]} bpm`);
  const temp = text.match(/(\d{2,3}(?:\.\d)?)\s*(?:°|degrees|\bF\b)/i);
  if (temp) parts.push(`${temp[1]}°F`);
  return parts.length ? parts.join('   ') : null;
}

function medsLine(meds: string[]): string | null {
  if (!meds.length) return null;
  return meds.length === 1 ? `${meds[0]} noted` : `${meds.length} medications noted`;
}

export default function LogsPage({
  onOpenReport,
  onOpenHistory,
}: {
  onOpenReport?: (id: string) => void;
  onOpenHistory?: () => void;
} = {}) {
  const router = useRouter();
  const openReport = onOpenReport ?? ((id: string) => router.push(`/logs/report/${id}`));
  const openHistory = onOpenHistory ?? (() => router.push('/logs/history'));
  const [view, setView] = useState<View>('voice-idle');
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [editingTranscript, setEditingTranscript] = useState('');
  const [conversation, setConversation] = useState<ConversationTurn[]>(INITIAL_CONVERSATION);
  const [activePatientId, setActivePatientId] = useState(SAMPLE_PATIENTS[0].id);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [compileState, setCompileState] = useState<CompileState>('idle');
  // The conversation is an overlay now, not a screen. `typing` swaps the
  // hold-to-talk pill for a text field without moving anything else.
  const [panelOpen, setPanelOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [report, setReport] = useState<ReportDraft>(EMPTY_DRAFT);

  /** Fold one note's result into today's report. Existing values win, so a
   * later vague note can't wipe an earlier specific one. */
  function fillReport(
    transcript: string,
    summary: Awaited<ReturnType<typeof api.summarize>>,
  ) {
    setReport((prev) => {
      const meds = summary.medications_noted ?? [];
      return {
        summary: summary.summary || prev.summary,
        vitals: prev.vitals ?? extractVitals(transcript),
        mood: prev.mood ?? (summary.mood || null),
        meds: prev.meds ?? medsLine(meds),
        medsTaken:
          prev.medsTaken.length > 0
            ? prev.medsTaken
            : meds.map((name) => ({ name, taken: true })),
        severity: summary.urgent ? 'urgent' : prev.severity,
      };
    });
  }

  /** Caregiver correction — a cleared field goes back to waiting. */
  function handleEditField(field: DraftField, value: string) {
    setReport((prev) => ({ ...prev, [field]: value.trim() || null }));
  }

  // SpeechRecognition is non-standard; type as any to avoid lib pollution.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
  // MediaRecorder runs in parallel so we can fall back to FastAPI /transcribe
  // when Web Speech errors out (network failure, unsupported browser, etc.).
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // When Web Speech fails, we poll /transcribe with accumulated audio every
  // few seconds for near-live captions. These refs coordinate that.
  const fallbackPollingRef = useRef(false);
  const transcribeInFlightRef = useRef(false);

  // Re-hydrate today's conversation from Supabase on mount / patient change.
  // INITIAL_CONVERSATION stays as a placeholder seed when no real data exists.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [logsRes, reportsRes] = await Promise.all([
        supabase
          .from('caregiver_logs')
          .select('*')
          .eq('caregiver_id', CAREGIVER_ID)
          .eq('patient_id', activePatientId)
          .eq('visit_date', today)
          .order('created_at'),
        supabase
          .from('compiled_reports')
          .select('*')
          .eq('caregiver_id', CAREGIVER_ID)
          .eq('patient_id', activePatientId)
          .eq('visit_date', today)
          .order('created_at'),
      ]);
      if (cancelled) return;

      const turns: { ts: string; turn: ConversationTurn }[] = [];
      for (const log of logsRes.data ?? []) {
        const time = new Date(log.created_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: false,
        });
        turns.push({
          ts: log.created_at,
          turn: {
            kind: 'user-audio',
            id: `log-${log.id}`,
            time,
            transcript: log.transcript,
          },
        });
        if (log.summary) {
          turns.push({
            ts: log.created_at,
            turn: {
              kind: 'ai-summary',
              id: `log-${log.id}-ai`,
              summary: log.summary,
              mood: log.mood ?? '',
              medicationsNoted: log.medications_noted ?? [],
              urgent: !!log.urgent,
            },
          });
        }
      }
      for (const report of reportsRes.data ?? []) {
        turns.push({
          ts: report.created_at,
          turn: {
            kind: 'report',
            id: `report-turn-${report.id}`,
            reportId: report.id,
            patientName: report.patient_name,
            visitDate: report.visit_date,
            visitTime: report.visit_time,
          },
        });
      }
      turns.sort((a, b) => a.ts.localeCompare(b.ts));
      if (turns.length > 0) setConversation(turns.map((t) => t.turn));
    })();
    return () => {
      cancelled = true;
    };
  }, [activePatientId]);

  async function persistLog(
    transcript: string,
    summary: Awaited<ReturnType<typeof api.summarize>>,
  ) {
    const { error: insertError } = await supabase.from('caregiver_logs').insert({
      caregiver_id: CAREGIVER_ID,
      patient_id: activePatientId,
      visit_date: new Date().toISOString().slice(0, 10),
      transcript,
      summary: summary.summary,
      mood: summary.mood,
      medications_noted: summary.medications_noted,
      urgent: summary.urgent,
    });
    if (insertError) {
      console.warn('Failed to persist caregiver log:', insertError);
      setError(`Save failed: ${insertError.message}`);
    }
  }

  async function handleCompile() {
    if (compileState !== 'idle') return;
    setError('');
    setCompileState('compiling');
    try {
      const result = await api.compileLogs(
        CAREGIVER_ID,
        activePatientId,
        activePatient?.name ?? 'Patient',
      );
      // Append a tappable "Erin's Report" card to the chat and jump to it.
      const turn: ConversationTurn = {
        kind: 'report',
        id: `report-turn-${result.id}`,
        reportId: result.id,
        patientName: activePatient?.name ?? 'Patient',
        visitDate: result.visit_date,
        visitTime: result.visit_time,
      };
      setConversation((prev) => [...prev, turn]);
      setPanelOpen(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not compile logs.');
    } finally {
      setCompileState('idle');
    }
  }

  const activePatient = SAMPLE_PATIENTS.find((p) => p.id === activePatientId);
  const recording = view === 'voice-recording' && recordState === 'recording';
  const barMode: BarMode = recording ? 'recording' : typing ? 'typing' : 'idle';
  // Saving on the voice screen = the /transcribe fallback; on the review
  // screen it's the summarize+persist step (label not shown there anyway).
  const busyLabel = recordState === 'saving' ? 'Transcribing…' : '';

  async function handlePressToSpeak() {
    if (recordState !== 'idle') return;
    setError('');
    finalTranscriptRef.current = '';
    setLiveTranscript('');

    // 1) Always start MediaRecorder so we have audio to fall back on.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone access denied.');
      return;
    }
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    fallbackPollingRef.current = false;
    transcribeInFlightRef.current = false;

    recorder.ondataavailable = async (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      // If Web Speech is dead, transcribe what we have so far. Skip if a
      // request is already in flight — they queue up otherwise.
      if (!fallbackPollingRef.current || transcribeInFlightRef.current) return;
      if (chunksRef.current.length === 0) return;
      transcribeInFlightRef.current = true;
      try {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const { transcript } = await api.transcribe(blob);
        // Web Speech may have woken up in the meantime — only overwrite if
        // we're still in fallback mode.
        if (fallbackPollingRef.current && recorderRef.current === recorder) {
          finalTranscriptRef.current = transcript;
          setLiveTranscript(transcript);
        }
      } catch {
        // ignore single-chunk failures; next tick will retry
      } finally {
        transcribeInFlightRef.current = false;
      }
    };
    // 3-second timeslice: emit a chunk every 3s so polling can transcribe.
    recorder.start(3000);
    recorderRef.current = recorder;

    // 2) Try Web Speech for live captions. If it fails (network / unsupported),
    //    we fall back to chunk-polled /transcribe on the backend.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      // No Web Speech at all — go straight to chunk polling.
      fallbackPollingRef.current = true;
    }
    if (SR) {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (e: any) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalTranscriptRef.current += t;
          else interim += t;
        }
        // Web Speech is alive — turn off the fallback poller.
        fallbackPollingRef.current = false;
        setLiveTranscript((finalTranscriptRef.current + interim).trim());
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (e: any) => {
        if (e.error && e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn(`Speech recognition: ${e.error} — switching to server transcription.`);
          // Activate the chunk poller for near-live captions via FastAPI.
          fallbackPollingRef.current = true;
        }
      };

      recognition.onend = () => {
        // Auto-restart if we're still actively recording (silence timeout).
        if (recognitionRef.current === recognition) {
          try { recognition.start(); } catch { /* already started */ }
        }
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
        // Watchdog: if Web Speech hasn't produced any output by 5s, assume
        // it's silently broken and activate the chunk-polling fallback.
        setTimeout(() => {
          if (
            recognitionRef.current === recognition &&
            !finalTranscriptRef.current &&
            !fallbackPollingRef.current
          ) {
            console.warn('Web Speech silent for 5s — activating server transcription.');
            fallbackPollingRef.current = true;
          }
        }, 5000);
      } catch {
        // Live captions unavailable; chunk polling will cover it.
        recognitionRef.current = null;
        fallbackPollingRef.current = true;
      }
    }

    setRecordState('recording');
    setView('voice-recording');
  }

  async function handleDone() {
    if (recordState !== 'recording') return;

    // Stop SpeechRecognition (if it was running) — null first to skip restart.
    const r = recognitionRef.current;
    recognitionRef.current = null;
    try { r?.stop(); } catch { /* noop */ }

    // Snapshot the live caption text, then stop the recorder synchronously
    // so we can grab the blob.
    const liveText = (finalTranscriptRef.current || liveTranscript).trim();
    const recorder = recorderRef.current;
    recorderRef.current = null;

    if (liveText) {
      // Web Speech captured something — use it. No need to transcribe on the
      // server. Stop the mic and move to review.
      try { recorder?.stop(); } catch { /* noop */ }
      recorder?.stream.getTracks().forEach((t) => t.stop());
      setEditingTranscript(liveText);
      setLiveTranscript('');
      setRecordState('idle');
      setView('voice-review');
      return;
    }

    // Fallback path: Web Speech produced nothing (network error / browser
    // doesn't support it). Send the recorded audio to FastAPI /transcribe.
    setLiveTranscript('');
    setRecordState('saving');
    setView('voice-recording'); // show busyLabel "Logging…" over the blob
    setError('');

    const blob: Blob = await new Promise((resolve) => {
      if (!recorder) return resolve(new Blob([], { type: 'audio/webm' }));
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: 'audio/webm' }));
      };
      try { recorder.stop(); } catch { resolve(new Blob([], { type: 'audio/webm' })); }
    });
    recorder?.stream.getTracks().forEach((t) => t.stop());

    try {
      const { transcript } = await api.transcribe(blob);
      setEditingTranscript(transcript);
      setView('voice-review');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not transcribe audio.');
      setEditingTranscript('');
      setView('voice-review');
    } finally {
      setRecordState('idle');
    }
  }

  function handleDiscardReview() {
    setEditingTranscript('');
    setLiveTranscript('');
    setError('');
    setView('voice-idle');
  }

  async function handleSendText() {
    const text = draft.trim();
    if (!text || recordState !== 'idle') return;
    setError('');
    const ts = Date.now();

    // Show the typed bubble immediately.
    setConversation((prev) => [
      ...prev,
      { kind: 'user-text', id: `turn-${ts}`, text },
    ]);
    setDraft('');
    setTyping(false);
    setPanelOpen(true);
    setRecordState('saving');

    try {
      const summary = await api.summarize(
        activePatient?.name ?? 'Patient',
        text,
        '',
      );
      const aiTurn: ConversationTurn = {
        kind: 'ai-summary',
        id: `turn-${ts}-ai`,
        summary: summary.summary || '(Note saved — summary not generated.)',
        mood: summary.mood || '',
        medicationsNoted: summary.medications_noted ?? [],
        urgent: !!summary.urgent,
      };
      setConversation((prev) => [...prev, aiTurn]);
      fillReport(text, summary);
      await persistLog(text, summary);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach the AI service.');
    } finally {
      setRecordState('idle');
    }
  }

  async function handleSaveReview() {
    const transcript = editingTranscript.trim();
    if (!transcript || recordState !== 'idle') return;
    setError('');
    setRecordState('saving');
    const ts = Date.now();
    try {
      const audioTurn: ConversationTurn = {
        kind: 'user-audio',
        id: `turn-${ts}`,
        time: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: false,
        }),
        transcript,
      };
      setConversation((prev) => [...prev, audioTurn]);

      const summary = await api.summarize(
        activePatient?.name ?? 'Patient',
        transcript,
        '',
      );
      const aiTurn: ConversationTurn = {
        kind: 'ai-summary',
        id: `turn-${ts}-ai`,
        summary: summary.summary || '(Note saved — summary not generated.)',
        mood: summary.mood || '',
        medicationsNoted: summary.medications_noted ?? [],
        urgent: !!summary.urgent,
      };
      setConversation((prev) => [...prev, aiTurn]);
      fillReport(transcript, summary);
      await persistLog(transcript, summary);
      setEditingTranscript('');
      setPanelOpen(true);
      setView('voice-idle');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach the AI service.');
      // Stay on the review view so the caregiver can retry / edit / discard.
      setView('voice-review');
    } finally {
      setRecordState('idle');
    }
  }

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      <header className="absolute left-[25px] right-[25px] top-[60px] z-10 flex items-center justify-between gap-3">
        <PatientSwitcher
          patients={SAMPLE_PATIENTS}
          activeId={activePatientId}
          onChange={setActivePatientId}
        />
        <div className="flex items-center gap-3">
          <IconBox size={42} aria-label="Search">
            <IconSearch className="size-6 text-gray-100" />
          </IconBox>
          {/* Past AI log sessions. Mode switching lives on the bottom-left
           * keyboard/mic toggle, so this slot opens the history list. */}
          <button
            type="button"
            aria-label="Open log history"
            onClick={openHistory}
            className="flex size-[42px] items-center justify-center rounded-[12px] bg-brand-primary transition-transform active:scale-95"
          >
            <IconHistory className="size-6 text-white" />
          </button>
        </div>
      </header>

      {/* Main background — today's report, filling in as notes land. */}
      {/* Bottom clearance for the collapsed sheet (148px). */}
      <div className="absolute bottom-[156px] left-0 right-0 top-[122px] overflow-y-auto px-[22px] pt-[10px] pb-[16px]">
        <VisitReportDraft
          patientName={activePatient?.name ?? 'Patient'}
          dateLabel={new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
          draft={report}
          filling={recordState === 'saving'}
          onEdit={handleEditField}
        />

        {error && (
          <p className="mt-4 text-center text-[13px] text-red-600">{error}</p>
        )}

        {/* Live caption while the pill is held. */}
        {recording && liveTranscript && (
          <p className="mt-4 rounded-[14px] bg-white/70 p-[14px] text-[15px] leading-[21px] text-gray-100">
            {liveTranscript}
          </p>
        )}
      </div>

      {/* Conversation + input in one surface: the sheet grows from behind the
        * input bar, so the control the caregiver is holding never moves. */}
      {view !== 'voice-review' && (
        <PullUpSheet
          open={panelOpen}
          onOpenChange={setPanelOpen}
          title="Alio"
          count={conversation.length}
          className="absolute bottom-0 left-0 right-0 z-10"
          expandedHeight="58vh"
          footer={
            <>
              {/* Finish the visit: compile the notes and hand them to the
                * family. Labelled, because "+" reads as "add another thing". */}
              <button
                type="button"
                onClick={handleCompile}
                disabled={compileState !== 'idle' || recordState !== 'idle'}
                className="mb-[10px] ml-auto flex items-center gap-[7px] rounded-full bg-brand-primary px-[14px] py-[8px] text-[13px] font-bold text-white shadow-[0_2px_12px_rgba(94,105,246,0.35)] transition-transform active:scale-95 disabled:opacity-50"
              >
                <IconSendMessage className="size-[16px] text-white" />
                Send to family
              </button>
              <HoldToTalkBar
                mode={barMode}
                value={draft}
                onChange={setDraft}
                onHoldStart={handlePressToSpeak}
                onHoldEnd={handleDone}
                onTap={() => setTyping(true)}
                onSend={handleSendText}
                onExitTyping={() => setTyping(false)}
                disabled={recordState === 'saving'}
              />
            </>
          }
        >
          <ConversationTurns turns={conversation} onOpenReport={openReport} />
        </PullUpSheet>
      )}

      {/* Review sheet — the one moment that takes over, because the caregiver
        * is editing what will be saved. */}
      {view === 'voice-review' && (
        <ReviewSheet
          value={editingTranscript}
          onChange={setEditingTranscript}
          saving={recordState === 'saving'}
          onDiscard={handleDiscardReview}
          onSave={handleSaveReview}
        />
      )}

      {compileState === 'compiling' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="rounded-2xl bg-white px-6 py-4 shadow-lg">
            <p className="text-gray-100">Compiling today’s report…</p>
          </div>
        </div>
      )}
    </div>
  );
}


/** The exchange with Alio, rendered inside the pull-up sheet. */
function ConversationTurns({
  turns,
  onOpenReport,
}: {
  turns: ConversationTurn[];
  onOpenReport: (id: string) => void;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns.length]);

  return (
    <div className="flex flex-col gap-3 pt-[4px]">
        {turns.map((turn) => {
          if (turn.kind === 'user-audio') {
            return (
              <AudioBubble
                key={turn.id}
                time={turn.time}
                transcript={turn.transcript}
                defaultExpanded
              />
            );
          }
          if (turn.kind === 'user-text') {
            return (
              <ChatBubble
                key={turn.id}
                message={{ id: turn.id, sender: 'me', text: turn.text }}
              />
            );
          }
          if (turn.kind === 'ai-tasks') {
            return <TaskCard key={turn.id} intro={turn.intro} tasks={turn.tasks} />;
          }
          if (turn.kind === 'report') {
            return (
              <ReportBubble
                key={turn.id}
                patientName={turn.patientName}
                onClick={() => onOpenReport(turn.reportId)}
              />
            );
          }
          return <SummaryBubble key={turn.id} turn={turn} />;
        })}
      <div ref={endRef} />
    </div>
  );
}

/**
 * ReviewSheet — the one step that takes the screen over, because the caregiver
 * is editing text that is about to be saved on their name.
 */
function ReviewSheet({
  value,
  onChange,
  saving,
  onDiscard,
  onSave,
}: {
  value: string;
  onChange: (v: string) => void;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 rounded-t-[24px] bg-white px-[20px] pb-[24px] pt-[16px] shadow-[0_-6px_28px_rgba(0,0,0,0.16)]">
      <div className="mx-auto mb-[14px] h-[4px] w-[38px] rounded-full bg-gray-30" />
      <p className="text-[16px] font-bold text-gray-100">Review &amp; edit</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={saving}
        autoFocus
        placeholder="Nothing was transcribed. Type your note here, or discard."
        className="mt-[12px] h-[180px] w-full resize-none rounded-[16px] bg-brand-tint-1 px-[14px] py-[12px] text-[15px] leading-relaxed text-gray-100 placeholder:text-gray-60 outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-60"
      />
      <div className="mt-[16px] flex gap-[10px]">
        <button
          type="button"
          onClick={onDiscard}
          disabled={saving}
          className="h-[48px] flex-1 rounded-[12px] bg-brand-tint-1 text-[14px] font-bold text-gray-100 transition-colors active:bg-brand-border disabled:opacity-50"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !value.trim()}
          className="h-[48px] flex-1 rounded-[12px] bg-brand-primary text-[14px] font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function ReportBubble({
  patientName,
  onClick,
}: {
  patientName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[64px] w-[232px] items-center justify-between rounded-[12px] bg-[#eeeeee] pl-[8px] pr-[16px] py-[12px] transition-colors active:bg-[#e2e2e2]"
    >
      <div className="flex items-center gap-[12px]">
        <div className="flex size-[40px] items-center justify-center rounded-[8px] bg-brand-tint-2 p-[5px]">
          <svg className="size-[24px] text-gray-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <span className="font-bold text-[14px] text-black">{patientName}’s Report</span>
      </div>
      <svg className="size-[16px] text-gray-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

function SummaryBubble({
  turn,
}: {
  turn: Extract<ConversationTurn, { kind: 'ai-summary' }>;
}) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      {turn.urgent && (
        <div className="mb-2 inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
          Urgent — review now
        </div>
      )}
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-60">Visit logged</p>
      <p className="mt-1 text-base leading-relaxed text-gray-100">{turn.summary}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs uppercase text-gray-60">Mood</p>
          <p className="text-gray-100">{turn.mood || '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-60">Medications</p>
          <p className="text-gray-100">
            {(turn.medicationsNoted ?? []).length ? (turn.medicationsNoted ?? []).join(', ') : 'None'}
          </p>
        </div>
      </div>
    </div>
  );
}
