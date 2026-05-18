'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  IconBox,
  PressToSpeakButton,
  GradientBlob,
  ModeDropdown,
  ChatBubble,
  UploadWheel,
  IconSearch,
  IconChat,
  IconKeyboard,
  IconPlus,
  IconMicrophone,
  IconArrowUp,
  type LogsMode,
  type UploadKind,
} from '@alio/ui';
import { type ChatMessage } from '@alio/mock-data';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const PATIENT_ID = 'erin-yeung';

async function askAI(message: string): Promise<string> {
  const res = await fetch(`${API_URL}/children/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: PATIENT_ID, message }),
  });
  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const data = await res.json();
  return data.reply as string;
}

type View = 'voice-idle' | 'voice-recording' | 'message';

export default function FamilyAICheckPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('voice-idle');
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [micError, setMicError] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fallbackPollingRef = useRef(false);
  const transcribeInFlightRef = useRef(false);

  const mode: LogsMode = view === 'message' ? 'message' : 'voice';

  const handleChangeMode = (next: LogsMode) => {
    setUploadOpen(false);
    if (next === 'voice') setView('voice-idle');
    else setView('message');
  };

  async function handlePressToSpeak() {
    setMicError('');
    setUploadOpen(false);
    finalTranscriptRef.current = '';
    setTranscript('');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError('Microphone access denied.');
      return;
    }

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    fallbackPollingRef.current = false;
    transcribeInFlightRef.current = false;

    recorder.ondataavailable = async (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      if (!fallbackPollingRef.current || transcribeInFlightRef.current) return;
      if (chunksRef.current.length === 0) return;
      transcribeInFlightRef.current = true;
      try {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const res = await fetch(`${API_URL}/transcribe`, { method: 'POST', body: blob });
        const { transcript: t } = await res.json();
        if (fallbackPollingRef.current && recorderRef.current === recorder) {
          finalTranscriptRef.current = t;
          setTranscript(t);
        }
      } catch { /* ignore */ } finally {
        transcribeInFlightRef.current = false;
      }
    };
    recorder.start(3000);
    recorderRef.current = recorder;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      fallbackPollingRef.current = true;
    } else {
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
        fallbackPollingRef.current = false;
        setTranscript((finalTranscriptRef.current + interim).trim());
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (e: any) => {
        if (e.error && e.error !== 'no-speech' && e.error !== 'aborted') {
          fallbackPollingRef.current = true;
        }
      };

      recognition.onend = () => {
        if (recognitionRef.current === recognition) {
          try { recognition.start(); } catch { /* already started */ }
        }
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
        setTimeout(() => {
          if (recognitionRef.current === recognition && !finalTranscriptRef.current && !fallbackPollingRef.current) {
            fallbackPollingRef.current = true;
          }
        }, 5000);
      } catch {
        recognitionRef.current = null;
        fallbackPollingRef.current = true;
      }
    }

    setView('voice-recording');
  }

  async function handleDone() {
    const r = recognitionRef.current;
    recognitionRef.current = null;
    try { r?.stop(); } catch { /* noop */ }

    const liveText = (finalTranscriptRef.current || transcript).trim();
    const recorder = recorderRef.current;
    recorderRef.current = null;

    let text = liveText;

    if (!liveText) {
      // Fallback: send recorded audio to /transcribe
      const blob: Blob = await new Promise((resolve) => {
        if (!recorder) return resolve(new Blob([], { type: 'audio/webm' }));
        recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: 'audio/webm' }));
        try { recorder.stop(); } catch { resolve(new Blob([], { type: 'audio/webm' })); }
      });
      recorder?.stream.getTracks().forEach((t) => t.stop());
      try {
        const res = await fetch(`${API_URL}/transcribe`, { method: 'POST', body: blob });
        const { transcript: t } = await res.json();
        text = t;
      } catch { text = ''; }
    } else {
      try { recorder?.stop(); } catch { /* noop */ }
      recorder?.stream.getTracks().forEach((t) => t.stop());
    }

    setTranscript('');
    if (!text) { setView('voice-idle'); return; }

    setConversation((prev) => [...prev, { id: `m-${Date.now()}`, sender: 'me', text }]);
    setView('message');
    setLoading(true);
    try {
      const reply = await askAI(text);
      setConversation((prev) => [...prev, { id: `m-${Date.now()}-ai`, sender: 'them', text: reply }]);
    } catch {
      setConversation((prev) => [...prev, { id: `m-${Date.now()}-err`, sender: 'them', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  const handleSendText = async () => {
    const text = draft.trim();
    if (!text || loading) return;
    setConversation((prev) => [...prev, { id: `m-${Date.now()}`, sender: 'me', text }]);
    setDraft('');
    if (view !== 'message') { setKeyboardOpen(false); setView('message'); }
    setLoading(true);
    try {
      const reply = await askAI(text);
      setConversation((prev) => [...prev, { id: `m-${Date.now()}-ai`, sender: 'them', text: reply }]);
    } catch {
      setConversation((prev) => [...prev, { id: `m-${Date.now()}-err`, sender: 'them', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPick = (kind: UploadKind) => {
    setUploadOpen(false);
    const labels: Record<UploadKind, string> = {
      voice: '🎤 [voice note attached]',
      photo: '🖼 [photo attached]',
      camera: '📷 [camera capture attached]',
    };
    setConversation((prev) => [...prev, { id: `m-${Date.now()}`, sender: 'me', text: labels[kind] }]);
    setView('message');
  };

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)' }}
    >
      <header className="absolute left-[25px] right-[25px] top-[60px] z-10 flex items-center justify-between gap-3">
        <ModeDropdown mode={mode} onChangeMode={handleChangeMode} />
        <div className="flex items-center gap-3">
          <IconBox size={42} aria-label="Search">
            <IconSearch className="size-6 text-gray-100" />
          </IconBox>
          <IconBox size={42} aria-label="Open chat history" onClick={() => router.push('/chat')}>
            <IconChat className="size-6 text-gray-100" />
          </IconBox>
        </div>
      </header>

      {view !== 'message' ? (
        <VoiceView view={view} transcript={transcript} micError={micError} loading={loading} />
      ) : (
        <MessageView turns={conversation} loading={loading} />
      )}

      {view === 'message' || keyboardOpen ? (
        <MessageInput
          value={draft}
          onChange={setDraft}
          onSend={handleSendText}
          onMicClick={keyboardOpen ? () => setKeyboardOpen(false) : undefined}
          uploadOpen={uploadOpen}
          onOpenUpload={() => setUploadOpen(true)}
          onCloseUpload={() => setUploadOpen(false)}
          onUploadPick={handleUploadPick}
          disabled={loading}
        />
      ) : (
        <div className="absolute bottom-[95px] left-[25px] right-[25px] z-10 flex items-center justify-between">
          <IconBox size={48} aria-label="Open keyboard" onClick={() => setKeyboardOpen(true)}>
            <IconKeyboard className="size-6 text-gray-100" />
          </IconBox>
          {view === 'voice-recording' ? (
            <PressToSpeakButton variant="recording" onClick={handleDone} className="w-[216px]" />
          ) : (
            <PressToSpeakButton variant="idle" onClick={handlePressToSpeak} className="w-[216px]" />
          )}
          <div className="relative">
            {uploadOpen ? (
              <UploadWheel open={uploadOpen} onClose={() => setUploadOpen(false)} onPick={handleUploadPick} className="bottom-0 right-0" />
            ) : (
              <button
                type="button"
                aria-label="More actions"
                onClick={() => setUploadOpen(true)}
                className="flex size-[48px] items-center justify-center rounded-lg bg-brand-tint-1 transition-colors active:bg-brand-border"
              >
                <IconPlus className="size-6 text-gray-100" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VoiceView({ view, transcript, micError, loading }: { view: View; transcript: string; micError: string; loading: boolean }) {
  const recording = view === 'voice-recording';
  return (
    <>
      <p
        className={clsx(
          'absolute left-1/2 top-[180px] -translate-x-1/2 whitespace-nowrap bg-clip-text text-xl font-bold text-transparent',
          recording
            ? 'animate-[listening-gradient_3.6s_ease-in-out_infinite] bg-[length:300%_100%] bg-[linear-gradient(90deg,#2B1B72_0%,#5E69F6_22%,#A29BFE_45%,#F4B6C8_60%,#D496F5_78%,#2B1B72_100%)]'
            : 'bg-gradient-to-r from-[#2B1B72] from-[10%] via-[#5E69F6] via-[55%] to-[#F4B6C8] to-[100%]',
        )}
      >
        {loading ? 'Thinking…' : 'Hi, I am listening'}
      </p>

      <div className="absolute left-1/2 top-[220px] h-[310px] w-[311px] -translate-x-1/2">
        <GradientBlob active={recording} className="h-full w-full" />
      </div>

      {micError && (
        <p className="absolute left-[40px] right-[40px] top-[540px] text-center text-sm text-red-500">{micError}</p>
      )}

      {recording && transcript && (
        <p className="absolute left-[40px] right-[40px] top-[540px] text-center text-base leading-snug text-gray-100">
          {transcript.split(' ').map((word, i, arr) => {
            const isLastFew = i >= arr.length - 4;
            return (
              <span key={i} className={isLastFew ? 'text-gray-100' : 'text-gray-60'}>
                {word}{' '}
              </span>
            );
          })}
        </p>
      )}
    </>
  );
}

function MessageView({ turns, loading }: { turns: ChatMessage[]; loading: boolean }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns.length, loading]);
  return (
    <div ref={scrollRef} className="absolute left-0 right-0 top-[122px] bottom-[180px] overflow-y-auto px-4 py-3">
      <div className="flex flex-col gap-3">
        {turns.map((m) => <ChatBubble key={m.id} message={m} />)}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-[20px] rounded-tl-[6px] bg-white px-4 py-2 text-sm text-gray-60">…</div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageInput({
  value, onChange, onSend, onMicClick, uploadOpen, onOpenUpload, onCloseUpload, onUploadPick, disabled,
}: {
  value: string; onChange: (v: string) => void; onSend: () => void; onMicClick?: () => void;
  uploadOpen: boolean; onOpenUpload: () => void; onCloseUpload: () => void; onUploadPick: (kind: UploadKind) => void; disabled?: boolean;
}) {
  const hasText = value.trim().length > 0;
  return (
    <div className="absolute bottom-[95px] left-[16px] right-[16px] z-10 flex items-center gap-[10px]">
      <div className="flex h-[44px] flex-1 items-center gap-[8px] rounded-full bg-white px-[14px] shadow-sm">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
          placeholder="I want you to..."
          disabled={disabled}
          className="flex-1 bg-transparent text-[14px] text-gray-100 placeholder:text-gray-60 outline-none disabled:opacity-50"
        />
        <button type="button" aria-label={onMicClick ? 'Back to voice mode' : 'Voice input'} onClick={onMicClick}
          className={`flex size-[24px] items-center justify-center ${onMicClick ? 'text-brand-primary' : 'text-gray-60'}`}>
          <IconMicrophone className="size-[18px]" />
        </button>
        <button type="button" aria-label="Send" onClick={onSend} disabled={!hasText || disabled}
          className="flex size-[28px] items-center justify-center rounded-full bg-brand-primary transition-transform active:scale-95 disabled:opacity-40">
          <IconArrowUp className="size-[16px] text-white" />
        </button>
      </div>
      <div className="relative">
        {uploadOpen ? (
          <UploadWheel open={uploadOpen} onClose={onCloseUpload} onPick={onUploadPick} className="bottom-0 right-0" />
        ) : (
          <button type="button" aria-label="More actions" onClick={onOpenUpload}
            className="flex size-[44px] items-center justify-center rounded-[12px] bg-white shadow-sm transition-colors active:bg-brand-tint-1">
            <IconPlus className="size-[22px] text-gray-100" />
          </button>
        )}
      </div>
    </div>
  );
}
