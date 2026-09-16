'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChatBubble,
  FAMILY_MEMBER_ID,
  IconBox,
  IconChevronLeft,
  IconSearch,
  IconMicrophone,
  IconPlus,
  IconReminder,
  IconRefresh,
  IconProfile,
  MessageActionSheet,
  MessageBubble,
  SUPABASE_THREAD_FOR_FAMILY,
  markPending,
  sendMessage,
  useFamilyMessages,
  type ThreadMessage,
} from '@alio/ui';
import {
  SAMPLE_FM_CHAT_THREADS,
  SAMPLE_FM_CONVERSATIONS,
  type ChatMessage,
} from '@alio/mock-data';
import { supabase } from '@/lib/supabase';
import { ReportCard } from '@/components/ReportCard';

/**
 * Family Chat conversation — same layout as Caregiver Chat conversation.
 * Threads with a Supabase mapping show mock history, then the live thread;
 * sends are written to Supabase, and a message you sent can be marked
 * Pending afterwards by long-pressing it (or right-clicking, on desktop).
 */
export default function FamilyChatConversationPage({ id: propId, onBack }: { id?: string; onBack?: () => void } = {}) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = propId ?? params?.id ?? '';
  const handleBack = onBack ?? (() => router.back());

  const thread = SAMPLE_FM_CHAT_THREADS.find((t) => t.id === id);
  const supabaseThreadId = SUPABASE_THREAD_FOR_FAMILY[id];

  const [mockMessages, setMockMessages] = useState<ChatMessage[]>(SAMPLE_FM_CONVERSATIONS[id] ?? []);
  const { messages: live, patch, upsert } = useFamilyMessages(
    supabase,
    supabaseThreadId ? { by: 'thread', threadId: supabaseThreadId } : null,
  );
  const [draft, setDraft] = useState('');
  const [sheetFor, setSheetFor] = useState<ThreadMessage | null>(null);
  // Shared banner for both the send path and the Mark-as-Pending path below.
  // Every attempt clears it up front, so a retry never shows a stale message
  // left over from a different, now-resolved failure.
  const [sendError, setSendError] = useState('');

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
          senderId: FAMILY_MEMBER_ID,
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

  const handleMarkPending = async (message: ThreadMessage) => {
    setSendError('');
    patch(message.id, { finalTier: 'action' });
    setSheetFor(null);
    try {
      await markPending(supabase, { messageId: message.id, taggedBy: 'sender_manual' });
      setSendError('');
    } catch (e) {
      console.error(e);
      patch(message.id, { finalTier: null });
      setSendError("Couldn't mark that as Pending. Check your connection and try again.");
    }
  };

  const handleCopy = async (message: ThreadMessage) => {
    setSendError('');
    try {
      await navigator.clipboard.writeText(message.text);
    } catch (e) {
      console.error(e);
    }
    setSheetFor(null);
  };

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      {/* Top header — back + avatar + name/status + search, at top-60 */}
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

      {/* Messages */}
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
            {live.map((m) =>
              m.reportId ? (
                <div key={m.id} className="flex" data-message-id={m.id}>
                  <ReportCard reportId={m.reportId} />
                </div>
              ) : (
                <MessageBubble
                  key={m.id}
                  message={m}
                  viewerId={FAMILY_MEMBER_ID}
                  onLongPress={m.senderId === FAMILY_MEMBER_ID ? setSheetFor : undefined}
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* Quick actions row */}
      <div className="absolute bottom-[72px] left-0 right-0 flex items-center justify-center gap-[10px] px-[16px]">
        <QuickAction icon={IconReminder} label="Send Notes" />
        <QuickAction icon={IconRefresh} label="Status Update" />
        <QuickAction icon={IconProfile} label="Contact" />
      </div>

      {/* Input row */}
      <div className="absolute bottom-[16px] left-0 right-0 flex flex-col gap-[6px] px-[16px]">
        {sendError && (
          <p role="alert" className="text-center text-[12px] font-bold text-alert">
            {sendError}
          </p>
        )}
        <div className="flex items-center gap-[10px]">
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
                // isComposing: Enter that commits an IME candidate must not send.
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

      <MessageActionSheet
        message={sheetFor}
        onMarkPending={handleMarkPending}
        onCopy={handleCopy}
        onClose={() => setSheetFor(null)}
      />
    </div>
  );
}

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
