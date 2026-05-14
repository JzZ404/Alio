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
import {
  SIMULATED_TRANSCRIPT,
  type ChatMessage,
} from '@alio/mock-data';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const PATIENT_ID = 'dorothy-chen';

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

/**
 * Family AI Check — voice + recording + message + image recognition + upload wheel.
 * Top-left "Alio voice ▾" / "Alio message ▾" dropdown switches view mode.
 * Bottom "+" button opens a vertical UploadWheel (mic, photo, camera).
 */
export default function FamilyAICheckPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('voice-idle');
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Mode derived from view (recording is still "voice" mode for the dropdown)
  const mode: LogsMode = view === 'message' ? 'message' : 'voice';

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

  const handleChangeMode = (next: LogsMode) => {
    setUploadOpen(false);
    if (next === 'voice') setView('voice-idle');
    else setView('message');
  };

  const handlePressToSpeak = () => {
    setUploadOpen(false);
    setView('voice-recording');
  };

  const handleDone = async () => {
    const text = transcript || SIMULATED_TRANSCRIPT;
    const userMsg: ChatMessage = { id: `m-${Date.now()}`, sender: 'me', text };
    setConversation((prev) => [...prev, userMsg]);
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
  };

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

  const handleCloseKeyboard = () => setKeyboardOpen(false);

  const handleUploadPick = (kind: UploadKind) => {
    // For the prototype we just close the wheel + append a placeholder message.
    setUploadOpen(false);
    const labels: Record<UploadKind, string> = {
      voice:  '🎤 [voice note attached]',
      photo:  '🖼 [photo attached]',
      camera: '📷 [camera capture attached]',
    };
    setConversation((prev) => [
      ...prev,
      { id: `m-${Date.now()}`, sender: 'me', text: labels[kind] },
    ]);
    // Drop into message mode so the new attachment is visible
    setView('message');
  };

  return (
    <div
      className="relative h-full min-h-screen overflow-hidden sm:h-[852px] sm:min-h-0"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      {/* Top bar — "Alio voice ▾" / "Alio message ▾" mode switcher + right icons */}
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

      {/* View body */}
      {view !== 'message' ? (
        <VoiceView view={view} transcript={transcript} />
      ) : (
        <MessageView turns={conversation} />
      )}

      {/* Bottom bar.
       *
       * Three states (in priority order):
       *   1) view === 'message' → text input (with mic = decorative, send = submit)
       *   2) view !== 'message' && keyboardOpen → text input (with mic = close-keyboard
       *      to return to the voice action bar)
       *   3) default voice mode → [Keyboard] [Press to Speak / Done] [Plus]
       */}
      {view === 'message' || keyboardOpen ? (
        <MessageInput
          value={draft}
          onChange={setDraft}
          onSend={handleSendText}
          onMicClick={keyboardOpen ? handleCloseKeyboard : undefined}
          uploadOpen={uploadOpen}
          onOpenUpload={() => setUploadOpen(true)}
          onCloseUpload={() => setUploadOpen(false)}
          onUploadPick={handleUploadPick}
        />
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

          {/* Plus button + UploadWheel anchored to the right edge */}
          <div className="relative">
            {uploadOpen ? (
              <UploadWheel
                open={uploadOpen}
                onClose={() => setUploadOpen(false)}
                onPick={handleUploadPick}
                className="bottom-0 right-0"
              />
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

// ----- Voice view (idle + recording) ---------------------------------------

function VoiceView({ view, transcript }: { view: View; transcript: string }) {
  const recording = view === 'voice-recording';
  return (
    <>
      <p
        className={clsx(
          'absolute left-1/2 top-[180px] -translate-x-1/2 whitespace-nowrap bg-clip-text text-xl font-bold text-transparent',
          // Purple → pink only: dark deep indigo at the ends, brand purple,
          // soft lavender, then light pastel pink as the brightest stop.
          // Varying lightness + saturation produces the "saturation pulse"
          // without leaving the purple/pink family.
          recording
            ? 'animate-[listening-gradient_3.6s_ease-in-out_infinite] bg-[length:300%_100%] bg-[linear-gradient(90deg,#2B1B72_0%,#5E69F6_22%,#A29BFE_45%,#F4B6C8_60%,#D496F5_78%,#2B1B72_100%)]'
            : 'bg-gradient-to-r from-[#2B1B72] from-[10%] via-[#5E69F6] via-[55%] to-[#F4B6C8] to-[100%]',
        )}
      >
        Hi, I am listening
      </p>

      <div className="absolute left-1/2 top-[220px] h-[310px] w-[311px] -translate-x-1/2">
        <GradientBlob active={recording} className="h-full w-full" />
      </div>

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

// ----- Message view (conversation with image recognition + attachments) ---

function MessageView({ turns }: { turns: ChatMessage[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns.length]);
  return (
    <div
      ref={scrollRef}
      className="absolute left-0 right-0 top-[122px] bottom-[180px] overflow-y-auto px-4 py-3"
    >
      <div className="flex flex-col gap-3">
        {turns.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
      </div>
    </div>
  );
}

// ----- Message-mode input bar (with the same upload wheel) -----------------

function MessageInput({
  value,
  onChange,
  onSend,
  onMicClick,
  uploadOpen,
  onOpenUpload,
  onCloseUpload,
  onUploadPick,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  /** Optional. When provided, the mic icon inside the input bar becomes a
   * "back to voice mode" toggle (used when keyboard was opened from voice
   * mode). When omitted, the icon is decorative. */
  onMicClick?: () => void;
  uploadOpen: boolean;
  onOpenUpload: () => void;
  onCloseUpload: () => void;
  onUploadPick: (kind: UploadKind) => void;
}) {
  const hasText = value.trim().length > 0;
  return (
    <div className="absolute bottom-[95px] left-[16px] right-[16px] z-10 flex items-center gap-[10px]">
      <div className="flex h-[44px] flex-1 items-center gap-[8px] rounded-full bg-white px-[14px] shadow-sm">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSend();
          }}
          placeholder="I want you to..."
          className="flex-1 bg-transparent text-[14px] text-gray-100 placeholder:text-gray-60 outline-none"
        />
        <button
          type="button"
          aria-label={onMicClick ? 'Back to voice mode' : 'Voice input'}
          onClick={onMicClick}
          className={`flex size-[24px] items-center justify-center ${onMicClick ? 'text-brand-primary' : 'text-gray-60'}`}
        >
          <IconMicrophone className="size-[18px]" />
        </button>
        <button
          type="button"
          aria-label="Send"
          onClick={onSend}
          className="flex size-[28px] items-center justify-center rounded-full bg-brand-primary transition-transform active:scale-95"
          disabled={!hasText}
        >
          <IconArrowUp className="size-[16px] text-white" />
        </button>
      </div>
      <div className="relative">
        {uploadOpen ? (
          <UploadWheel
            open={uploadOpen}
            onClose={onCloseUpload}
            onPick={onUploadPick}
            className="bottom-0 right-0"
          />
        ) : (
          <button
            type="button"
            aria-label="More actions"
            onClick={onOpenUpload}
            className="flex size-[44px] items-center justify-center rounded-[12px] bg-white shadow-sm transition-colors active:bg-brand-tint-1"
          >
            <IconPlus className="size-[22px] text-gray-100" />
          </button>
        )}
      </div>
    </div>
  );
}
