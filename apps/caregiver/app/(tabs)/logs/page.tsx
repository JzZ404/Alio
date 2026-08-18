'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  IconBox,
  PressToSpeakButton,
  VoiceListeningView,
  PatientSwitcher,
  AudioBubble,
  TaskCard,
  ChatBubble,
  IconSearch,
  IconChatswitch,
  IconMicrophoneFilled,
  IconKeyboard,
  IconPlus,
  IconMicrophone,
  IconArrowUp,
} from '@alio/ui';
import {
  INITIAL_CONVERSATION,
  SIMULATED_TRANSCRIPT,
  SAMPLE_PATIENTS,
  type ConversationTurn,
} from '@alio/mock-data';

type View = 'voice-idle' | 'voice-recording' | 'message';

export default function LogsPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('voice-idle');
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<ConversationTurn[]>(INITIAL_CONVERSATION);
  const [activePatientId, setActivePatientId] = useState(SAMPLE_PATIENTS[0].id);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [draft, setDraft] = useState('');

  // Simulated transcript stream during recording
  useEffect(() => {
    if (view !== 'voice-recording') {
      setTranscript('');
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setTranscript(SIMULATED_TRANSCRIPT.slice(0, i));
      if (i >= SIMULATED_TRANSCRIPT.length) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [view]);

  const handlePressToSpeak = () => {
    setKeyboardOpen(false);
    setView('voice-recording');
  };

  // Typed text from the keyboard input renders as a plain user-text bubble
  // (not the audio waveform). Then drop into message view.
  const handleSendText = () => {
    const text = draft.trim();
    if (!text) return;
    const ts = Date.now();
    setConversation((prev) => [
      ...prev,
      { kind: 'user-text', id: `turn-${ts}`, text },
    ]);
    setDraft('');
    setKeyboardOpen(false);
    setView('message');
  };

  // Pressing Done saves the recording to the conversation BUT stays in voice mode.
  // To view the conversation, user toggles Message via the dropdown.
  const handleDone = () => {
    const ts = Date.now();
    const newTurn: ConversationTurn = {
      kind: 'user-audio',
      id: `turn-${ts}`,
      time: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: false,
      }),
      transcript: transcript || SIMULATED_TRANSCRIPT,
    };
    const aiResponse: ConversationTurn = {
      kind: 'ai-tasks',
      id: `turn-${ts}-ai`,
      intro: 'Got it. Here are the rest of the to-dos for today.',
      tasks: [
        { id: `n${ts}-1`, label: 'Help Sarah shower', done: false },
        { id: `n${ts}-2`, label: 'Daily medication', done: false },
        { id: `n${ts}-3`, label: 'Check vitals at 4pm', done: false },
      ],
    };
    setConversation((prev) => [...prev, newTurn, aiResponse]);
    setView('voice-idle'); // stay in voice mode
  };

  // View toggle is now done via the chat icon at top-right (history list).
  // Voice idle ↔ message conversation can still be reached by tapping
  // history then back, or simply via the Done flow.

  return (
    <div
      className="relative h-full min-h-screen overflow-hidden sm:h-[852px] sm:min-h-0"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      {/* Top bar — patient switcher (left) + Search/Chat actions (right) */}
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
          {/* Mode-switch button — toggles voice ↔ message.
           * Voice mode  → shows IconChatswitch  → tap goes to message view.
           * Message mode → shows microphone icon → tap goes back to voice. */}
          <button
            type="button"
            aria-label={
              view === 'message' ? 'Switch to voice mode' : 'Switch to message mode'
            }
            onClick={() => setView(view === 'message' ? 'voice-idle' : 'message')}
            className="flex size-[42px] items-center justify-center rounded-[12px] bg-brand-primary transition-transform active:scale-95"
          >
            {view === 'message' ? (
              <IconMicrophoneFilled className="size-6 text-white" />
            ) : (
              <IconChatswitch className="size-6 text-white" />
            )}
          </button>
        </div>
      </header>

      {/* View body */}
      {view !== 'message' ? (
        <VoiceView view={view} transcript={transcript} />
      ) : (
        <MessageView turns={conversation} />
      )}

      {/* Bottom bar.
       *
       * - message view OR keyboardOpen → text input bar (same shape as the
       *   family AI message-mode input). Mic icon inside the input closes
       *   the keyboard and returns to the voice action bar.
       * - default voice mode → [Keyboard] [Press to Speak / Done] [Plus]
       */}
      {view === 'message' || keyboardOpen ? (
        <div className="absolute bottom-[95px] left-[16px] right-[16px] z-10 flex items-center gap-[10px]">
          <div className="flex h-[44px] flex-1 items-center gap-[8px] rounded-full bg-white px-[14px] shadow-sm">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendText();
              }}
              placeholder="Type a note..."
              className="flex-1 bg-transparent text-[14px] text-gray-100 placeholder:text-gray-60 outline-none"
            />
            <button
              type="button"
              aria-label={keyboardOpen ? 'Back to voice mode' : 'Voice input'}
              onClick={keyboardOpen ? () => setKeyboardOpen(false) : undefined}
              className={`flex size-[24px] items-center justify-center ${
                keyboardOpen ? 'text-brand-primary' : 'text-gray-60'
              }`}
            >
              <IconMicrophone className="size-[18px]" />
            </button>
            <button
              type="button"
              aria-label="Send"
              onClick={handleSendText}
              disabled={!draft.trim()}
              className="flex size-[28px] items-center justify-center rounded-full bg-brand-primary transition-transform active:scale-95 disabled:opacity-50"
            >
              <IconArrowUp className="size-[16px] text-white" />
            </button>
          </div>
          <button
            type="button"
            aria-label="More actions"
            className="flex size-[44px] items-center justify-center rounded-[12px] bg-white shadow-sm transition-colors active:bg-brand-tint-1"
          >
            <IconPlus className="size-[22px] text-gray-100" />
          </button>
        </div>
      ) : (
        <div className="absolute bottom-[95px] left-[25px] right-[25px] z-10 flex items-center justify-between">
          <IconBox
            size={48}
            aria-label="Open keyboard"
            onClick={() => setKeyboardOpen(true)}
          >
            <IconKeyboard className="size-6 text-gray-100" />
          </IconBox>
          {view === 'voice-recording' ? (
            <PressToSpeakButton variant="recording" onClick={handleDone} className="w-[216px]" />
          ) : (
            <PressToSpeakButton variant="idle" onClick={handlePressToSpeak} className="w-[216px]" />
          )}
          <IconBox size={48} aria-label="More actions">
            <IconPlus className="size-6 text-gray-100" />
          </IconBox>
        </div>
      )}
    </div>
  );
}

// ---------- Voice view (idle + recording) ----------
function VoiceView({ view, transcript }: { view: View; transcript: string }) {
  return (
    <VoiceListeningView listening={view === 'voice-recording'} transcript={transcript} />
  );
}

// ---------- Message view (conversation) ----------
function MessageView({ turns }: { turns: ConversationTurn[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when new turns added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns.length]);

  return (
    <div
      ref={scrollRef}
      className="absolute left-0 right-0 top-[122px] bottom-[170px] overflow-y-auto px-4 py-2"
    >
      <div className="flex flex-col gap-3">
        {turns.map((turn) => {
          if (turn.kind === 'user-audio') {
            return (
              <AudioBubble
                key={turn.id}
                time={turn.time}
                transcript={turn.transcript}
              />
            );
          }
          if (turn.kind === 'user-text') {
            // Typed text from the keyboard input → plain text bubble
            return (
              <ChatBubble
                key={turn.id}
                message={{ id: turn.id, sender: 'me', text: turn.text }}
              />
            );
          }
          return <TaskCard key={turn.id} intro={turn.intro} tasks={turn.tasks} />;
        })}
      </div>
    </div>
  );
}
