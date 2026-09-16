'use client';

import { useMemo } from 'react';
import {
  CAREGIVER_ID,
  ChatListItem,
  IconBox,
  IconFilter,
  IconSearch,
  InboxSummaryCard,
  confirmedRecencyLabel,
  selectPending,
  selectRecentlyConfirmed,
  useFamilyMessages,
  waitingSinceLabel,
} from '@alio/ui';
import { SAMPLE_CHAT_THREADS } from '@alio/mock-data';
import { supabase } from '@/lib/supabase';
import { DEMO_CONFIRMED, DEMO_PENDING } from '@/lib/pending-fixtures';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
 * The Pending/Confirmed counts mirror `PendingScreen`'s live+demo merge
 * exactly (live `useFamilyMessages` rows first, then the `demo-` fixtures,
 * re-sorted through the same `selectPending` / `selectRecentlyConfirmed`
 * helpers) so the cards here never disagree with what that screen shows.
 */
export default function CaregiverChatPage({
  onOpenThread,
  onOpenPending,
}: {
  onOpenThread?: (id: string) => void;
  onOpenPending?: (tab: 'pending' | 'confirmed') => void;
} = {}) {
  const since = useMemo(() => new Date(Date.now() - SEVEN_DAYS_MS), []);
  const { messages } = useFamilyMessages(supabase, {
    by: 'recipient',
    recipientId: CAREGIVER_ID,
    since,
  });

  // Generated once, from the clock at mount — this screen only ever reads
  // counts, it never confirms anything, so the fixtures don't need state.
  const now = useMemo(() => new Date(), []);
  const demoPending = useMemo(() => DEMO_PENDING(now), [now]);
  const demoConfirmed = useMemo(() => DEMO_CONFIRMED(now), [now]);

  const livePending = selectPending(messages, CAREGIVER_ID);
  const liveConfirmed = selectRecentlyConfirmed(messages, CAREGIVER_ID, now);

  // Merge live and demo with live first, then re-sort with the same helpers
  // PendingScreen uses, so ordering and membership always agree with it.
  const pending = selectPending([...livePending, ...demoPending], CAREGIVER_ID);
  const confirmed = selectRecentlyConfirmed([...liveConfirmed, ...demoConfirmed], CAREGIVER_ID, now);

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
