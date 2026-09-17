'use client';

import { useMemo } from 'react';
import {
  ChatListItem,
  IconBox,
  IconFilter,
  IconSearch,
  InboxSummaryCard,
  confirmedRecencyLabel,
  waitingSinceLabel,
} from '@alio/ui';
import { SAMPLE_CHAT_THREADS } from '@alio/mock-data';
import { useCaregiverPending } from '@/lib/use-caregiver-pending';

/**
 * Caregiver Inbox tab — the chat-list header renamed for the Pending
 * Confirmations feature, plus two always-visible summary cards, plus the
 * unchanged list of conversation threads.
 * Figma: `GC - Chat - initial page` (254:2503).
 *
 * Header is positioned at `top-[60px] left-[25px] right-[25px]` to match the
 * "Alio voice" pill position on the Logs screen — keeps the top toolbar
 * height consistent across the app.
 *
 * The Pending/Confirmed counts come from `useCaregiverPending` — the one
 * live+demo merge the Home bell and the Pending screen also read, so the
 * three surfaces can never disagree about how much is waiting.
 */
export default function CaregiverChatPage({
  onOpenThread,
  onOpenPending,
}: {
  onOpenThread?: (id: string) => void;
  onOpenPending?: (tab: 'pending' | 'confirmed') => void;
} = {}) {
  // This screen only reads counts, so one clock reading at mount is enough.
  const now = useMemo(() => new Date(), []);
  const { pending, confirmed, error } = useCaregiverPending(now);

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      {/* Top header — "Inbox" pill + Search + Filter */}
      <header className="absolute left-[25px] right-[25px] top-[60px] z-10 flex items-center justify-between">
        <span className="flex h-[42px] items-center rounded-[10px] bg-brand-tint-1 px-[12px] text-[20px] font-bold text-black">
          Inbox
        </span>
        <div className="flex items-center gap-[12px]">
          <IconBox size={42} shape="pill" aria-label="Search chats">
            <IconSearch className="size-[24px] text-gray-100" />
          </IconBox>
          <IconBox size={42} shape="pill" aria-label="Filter chats">
            <IconFilter className="size-[24px] text-gray-100" />
          </IconBox>
        </div>
      </header>

      {/* Pending / Confirmed summary cards — always visible, including at zero */}
      <div className="absolute left-[25px] right-[25px] top-[140px] flex gap-[12px]">
        <InboxSummaryCard
          count={pending.length}
          label="Pending"
          detail={waitingSinceLabel(pending)}
          onOpen={() => onOpenPending?.('pending')}
        />
        <InboxSummaryCard
          count={confirmed.length}
          label="Confirmed"
          detail={confirmedRecencyLabel(confirmed, now)}
          onOpen={() => onOpenPending?.('confirmed')}
        />
      </div>

      {/* The cards can only ever show a number, and a number cannot say "I
          don't know". Without this line an unreachable backend reads as a
          calm "0 Pending" — the one thing this feature exists to prevent. */}
      {error && (
        <p className="absolute left-[25px] right-[25px] top-[214px] text-[13px] text-gray-60">
          {"Couldn't load — check your connection"}
        </p>
      )}

      {/* Thread list — unchanged appearance, just starts lower to clear the cards */}
      <ul className="absolute bottom-[16px] left-[22px] right-[22px] top-[248px] flex flex-col gap-[12px] overflow-y-auto">
        {SAMPLE_CHAT_THREADS.map((thread) => (
          <li key={thread.id}>
            <ChatListItem thread={thread} onOpen={onOpenThread} />
          </li>
        ))}
      </ul>
    </div>
  );
}
