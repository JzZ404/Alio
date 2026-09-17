'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CAREGIVER_ID,
  ChatBubble,
  IconBox,
  IconChevronLeft,
  IconSearch,
  IconMicrophone,
  IconPlus,
  IconReminder,
  IconRefresh,
  IconProfile,
  MessageBubble,
  SUPABASE_THREAD_FOR_CAREGIVER,
  acknowledgeMessage,
  sendMessage,
  useFamilyMessages,
} from '@alio/ui';
import {
  SAMPLE_CHAT_THREADS,
  SAMPLE_CONVERSATIONS,
  type ChatMessage,
} from '@alio/mock-data';
import { supabase } from '@/lib/supabase';

const HIGHLIGHT_MS = 1600;

/**
 * Caregiver Chat conversation — Figma: `GC - Chat - conversation` (388:3940).
 * Header with back + avatar + name + online + search, message bubbles
 * (right=me, left=them), quick actions row, input bar. Threads with a Supabase
 * mapping show mock history, then the live thread, where Pending messages
 * carry Confirm in the bubble.
 */
export default function ChatConversationPage({
  id: propId,
  onBack,
  focusMessageId,
}: {
  id?: string;
  onBack?: () => void;
  focusMessageId?: string;
} = {}) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = propId ?? params?.id ?? '';
  const handleBack = onBack ?? (() => router.back());

  const thread = SAMPLE_CHAT_THREADS.find((t) => t.id === id);
  const supabaseThreadId = SUPABASE_THREAD_FOR_CAREGIVER[id];

  const [mockMessages, setMockMessages] = useState<ChatMessage[]>(SAMPLE_CONVERSATIONS[id] ?? []);
  const { messages: live, patch, upsert } = useFamilyMessages(
    supabase,
    supabaseThreadId ? { by: 'thread', threadId: supabaseThreadId } : null,
  );
  const [draft, setDraft] = useState('');
  // Shared banner for both the send path and Confirm below. Every attempt
  // clears it up front, so a retry never shows a stale message left over
  // from a different, now-resolved failure.
  const [sendError, setSendError] = useState('');

  // Jump-to-message from the Pending list: scroll the target bubble into
  // view once it exists, then highlight it briefly. `live` is a dependency
  // only so this retries once the realtime load populates the DOM node;
  // `focusedRef` guards it so the scroll+highlight itself only ever fires
  // once per target id, not on every subsequent message update.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const focusedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!focusMessageId || focusedRef.current === focusMessageId) return;
    const el = document.querySelector(`[data-message-id="${focusMessageId}"]`);
    if (!el) return;
    focusedRef.current = focusMessageId;
    el.scrollIntoView({ block: 'center' });
    setHighlightedId(focusMessageId);
  }, [focusMessageId, live]);

  // Clears the highlight on its own clock, independent of the effect above,
  // so a realtime message arriving mid-highlight can't cancel the fade-out.
  useEffect(() => {
    if (!highlightedId) return;
    const timer = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightedId]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setSendError('');
    if (!supabaseThreadId) {
      setMockMessages((prev) => [...prev, { id: `m-${Date.now()}`, sender: 'me', text }]);
      return;
    }
    try {
      upsert(
        await sendMessage(supabase, {
          threadId: supabaseThreadId,
          senderId: CAREGIVER_ID,
          text,
          needsResponse: false,
        }),
      );
      setSendError('');
    } catch (e) {
      console.error(e);
      setDraft(text);
      setSendError("Message didn't send. Check your connection and try again.");
    }
  };

  const handleConfirm = async (messageId: string) => {
    setSendError('');
    const at = new Date();
    patch(messageId, { acknowledgedAt: at.toISOString() });
    try {
      await acknowledgeMessage(supabase, { messageId, userId: CAREGIVER_ID, at });
      setSendError('');
    } catch (e) {
      console.error(e);
      patch(messageId, { acknowledgedAt: null }, { rollback: true });
      setSendError("Couldn't confirm. Check your connection and tap Confirm again.");
    }
  };

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      {/* Top header — pinned at top-60 to match the rest of the app */}
      <header className="absolute left-[25px] right-[25px] top-[60px] z-10 flex items-center gap-[12px]">
        <IconBox
          size={42}
          shape="pill"
          aria-label="Back"
          onClick={handleBack}
        >
          <IconChevronLeft className="size-[20px] text-gray-100" />
        </IconBox>

        <span className="relative flex size-[42px] shrink-0">
          {thread?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thread.avatarUrl}
              alt={thread.name}
              className="size-full rounded-full object-cover"
              width={42}
              height={42}
            />
          ) : (
            <span className="size-full rounded-full bg-gray-30" />
          )}
          {thread?.status === 'online' && (
            <span className="absolute bottom-0 right-0 size-[10px] rounded-full border-2 border-brand-tint-2 bg-brand-accent" />
          )}
        </span>

        <div className="flex flex-1 flex-col gap-[2px] leading-none">
          <span className="text-[16px] font-bold text-brand-primary">
            {thread?.name ?? 'Unknown'}
          </span>
          <span className="text-[12px] text-gray-60">
            {thread?.status === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>

        <IconBox size={42} shape="pill" aria-label="Search this conversation">
          <IconSearch className="size-[20px] text-gray-100" />
        </IconBox>
      </header>

      {/* Messages — start below header (60+42+27=129), end above quick actions */}
      <div className="absolute bottom-[120px] left-0 right-0 top-[129px] overflow-y-auto px-[16px] py-[12px]">
        {mockMessages.length === 0 && live.length === 0 ? (
          <p className="mt-12 text-center text-sm text-gray-60">
            No messages yet — say hi 👋
          </p>
        ) : (
          <div className="flex flex-col gap-[12px]">
            {mockMessages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
            {live.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                viewerId={CAREGIVER_ID}
                onConfirm={handleConfirm}
                highlighted={m.id === highlightedId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick actions row — anchored above input bar */}
      <div className="absolute bottom-[72px] left-0 right-0 flex items-center justify-center gap-[10px] px-[16px]">
        <QuickAction icon={IconReminder} label="Send Notes" />
        <QuickAction icon={IconRefresh} label="Status Update" />
        <QuickAction icon={IconProfile} label="Contact" />
      </div>

      {sendError && (
        <p
          role="alert"
          className="absolute bottom-[112px] left-0 right-0 px-[16px] text-center text-[12px] font-bold text-alert"
        >
          {sendError}
        </p>
      )}

      {/* Input row — anchored above tab bar */}
      <div className="absolute bottom-[16px] left-0 right-0 flex items-center gap-[10px] px-[16px]">
        <button
          type="button"
          aria-label="Record voice message"
          className="flex size-[44px] items-center justify-center rounded-full bg-white/70 transition-colors active:bg-white"
        >
          <IconMicrophone className="size-[22px] text-gray-100" />
        </button>

        <div className="flex h-[44px] flex-1 items-center gap-2 rounded-full bg-white/70 px-[14px]">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend();
            }}
            placeholder=""
            className="flex-1 bg-transparent text-[14px] text-gray-100 placeholder:text-gray-60 outline-none"
          />
          <button
            type="button"
            aria-label="Insert emoji"
            className="flex size-[24px] items-center justify-center text-gray-60"
          >
            <span className="text-[18px]">☺</span>
          </button>
        </div>

        <button
          type="button"
          aria-label="More actions"
          onClick={handleSend}
          className="flex size-[44px] items-center justify-center rounded-[12px] bg-white/70 transition-colors active:bg-white"
        >
          <IconPlus className="size-[22px] text-gray-100" />
        </button>
      </div>
    </div>
  );
}

/** Outlined pill button for the row above the input. */
function QuickAction({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      className="flex h-[34px] items-center gap-[6px] rounded-full border border-brand-border bg-white/40 px-[12px] transition-colors active:bg-white/70"
    >
      <Icon className="size-[16px] text-gray-100" />
      <span className="text-[12px] font-bold text-gray-100">{label}</span>
    </button>
  );
}
