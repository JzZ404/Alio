'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChatBubble,
  IconBox,
  IconChevronLeft,
  IconSearch,
  IconMicrophone,
  IconPlus,
  IconReminder,
  IconRefresh,
  IconProfile,
} from '@alio/ui';
import {
  SAMPLE_CHAT_THREADS,
  SAMPLE_CONVERSATIONS,
  type ChatMessage,
} from '@alio/mock-data';

/**
 * Caregiver Chat conversation — Figma: `GC - Chat - conversation` (388:3940).
 * Header with back + avatar + name + online + search, message bubbles
 * (right=me, left=them), quick actions row, input bar.
 */
export default function ChatConversationPage({ id: propId, onBack }: { id?: string; onBack?: () => void } = {}) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = propId ?? params?.id ?? '';
  const handleBack = onBack ?? (() => router.back());

  const thread = SAMPLE_CHAT_THREADS.find((t) => t.id === id);
  const initial = SAMPLE_CONVERSATIONS[id] ?? [];

  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [draft, setDraft] = useState('');

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: `m-${Date.now()}`, sender: 'me', text },
    ]);
    setDraft('');
  };

  return (
    <div
      className="relative h-full min-h-screen overflow-hidden sm:h-[852px] sm:min-h-0"
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
      <div className="absolute bottom-[200px] left-0 right-0 top-[129px] overflow-y-auto px-[16px] py-[12px]">
        {messages.length === 0 ? (
          <p className="mt-12 text-center text-sm text-gray-60">
            No messages yet — say hi 👋
          </p>
        ) : (
          <div className="flex flex-col gap-[12px]">
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      {/* Quick actions row — anchored above input bar */}
      <div className="absolute bottom-[152px] left-0 right-0 flex items-center justify-center gap-[10px] px-[16px]">
        <QuickAction icon={IconReminder} label="Send Notes" />
        <QuickAction icon={IconRefresh} label="Status Update" />
        <QuickAction icon={IconProfile} label="Contact" />
      </div>

      {/* Input row — anchored above tab bar */}
      <div className="absolute bottom-[100px] left-0 right-0 flex items-center gap-[10px] px-[16px]">
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
              if (e.key === 'Enter') handleSend();
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
