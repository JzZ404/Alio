'use client';

import { useEffect, useState } from 'react';
import {
  CAREGIVER_ID,
  ConfirmedRow,
  IconBox,
  IconChevronLeft,
  IconFilter,
  IconSearch,
  PendingCard,
  SegmentedTabs,
  acknowledgeMessage,
  groupConfirmedByDay,
  oldestWaitingLabel,
  type ThreadMessage,
} from '@alio/ui';
import { supabase } from '@/lib/supabase';
import { confirmDemoMessage } from '@/lib/pending-fixtures';
import { useCaregiverPending } from '@/lib/use-caregiver-pending';

const EXIT_MS = 300;

/** A demo fixture's id is always prefixed this way — the guard that keeps it away from Supabase. */
const isDemoId = (id: string) => id.startsWith('demo-');

/** Ticks a Date every `intervalMs`, local to this screen so waiting labels stay current. */
function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Screens 2/3 of the Chat feature (Figma: `GC - Chat - pending` /
 * `GC - Chat - confirmed`): one screen, two tabs behind a `SegmentedTabs`.
 *
 * Both lists come from `useCaregiverPending`, shared with the Inbox cards and
 * the Home bell so no two surfaces can disagree. Live messages come from
 * Supabase; demo senders (Emily, Charles, Miranda —
 * `apps/caregiver/lib/pending-fixtures.ts`) sit alongside them so the screen
 * shows the range of senders the design calls for. A demo fixture's id is
 * always prefixed `demo-`, and confirming one only ever updates the fixture
 * store — `isDemoId` guards every path that could otherwise reach
 * `acknowledgeMessage`.
 */
export function PendingScreen({
  initialTab,
  onBack,
  onOpenMessage,
}: {
  initialTab: 'pending' | 'confirmed';
  onBack: () => void;
  onOpenMessage: (message: ThreadMessage) => void;
}) {
  const [tab, setTab] = useState<'pending' | 'confirmed'>(initialTab);
  const now = useNow(60_000);

  const { pending, confirmed, error, patch } = useCaregiverPending(now);

  // Ids mid-exit-animation: still rendered (so the 300ms transition can run),
  // but no longer counted once the underlying data actually changes.
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());

  const groups = groupConfirmedByDay(confirmed, now);
  const oldest = oldestWaitingLabel(pending, now);

  const confirmLive = async (messageId: string) => {
    const at = new Date();
    patch(messageId, { acknowledgedAt: at.toISOString() });
    try {
      await acknowledgeMessage(supabase, { messageId, userId: CAREGIVER_ID, at });
    } catch (e) {
      console.error(e);
      patch(messageId, { acknowledgedAt: null }, { rollback: true });
    }
  };

  const handleConfirm = (messageId: string) => {
    // Confirm has no disabled state while the card animates out, so a second
    // tap inside those 300ms would run the whole thing twice — two writes
    // live, and a duplicate row (and duplicate React key) on a fixture.
    if (leavingIds.has(messageId)) return;
    setLeavingIds((prev) => new Set(prev).add(messageId));
    setTimeout(() => {
      setLeavingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      if (isDemoId(messageId)) {
        confirmDemoMessage(messageId, new Date().toISOString());
        return;
      }
      void confirmLive(messageId);
    }, EXIT_MS);
  };

  const handleOpen = (message: ThreadMessage) => {
    // A demo sender has no real thread position to jump to.
    if (isDemoId(message.id)) return;
    onOpenMessage(message);
  };

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      <header className="absolute left-[25px] right-[25px] top-[60px] z-10 flex items-center gap-[12px]">
        <IconBox size={42} shape="pill" aria-label="Back" onClick={onBack}>
          <IconChevronLeft className="size-[20px] text-gray-100" />
        </IconBox>
        <span className="flex h-[42px] items-center rounded-[10px] bg-brand-tint-1 px-[12px] text-[20px] font-bold text-black">
          Inbox
        </span>
        <div className="ml-auto flex items-center gap-[12px]">
          <IconBox size={42} shape="pill" aria-label="Search">
            <IconSearch className="size-[24px] text-gray-100" />
          </IconBox>
          <IconBox size={42} shape="pill" aria-label="Filter">
            <IconFilter className="size-[24px] text-gray-100" />
          </IconBox>
        </div>
      </header>

      <div className="absolute left-[25px] right-[25px] top-[140px]">
        <SegmentedTabs
          tabs={[
            { value: 'pending', label: 'Pending', badge: pending.length },
            { value: 'confirmed', label: 'Confirmed' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className="absolute bottom-[16px] left-[25px] right-[25px] top-[204px] overflow-y-auto">
        <div key={tab} className="animate-tab-in">
        {/* A load that failed must not read as a quiet inbox — this is the one
            feature whose whole promise is that nothing gets lost. */}
        {error && (
          <p className="py-[16px] text-center text-[14px] text-gray-60">
            {"Couldn't load — check your connection"}
          </p>
        )}
        {tab === 'pending' ? (
          <>
            {pending.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-gray-60">
                  WAITING ON YOU
                </span>
                {oldest && <span className="text-[12px] font-bold text-brand-primary">{oldest}</span>}
              </div>
            )}
            {pending.length === 0 && !error && (
              <p className="py-[24px] text-center text-[14px] text-gray-60">Nothing pending</p>
            )}
            {pending.length > 0 && (
              <div className="mt-[12px] flex flex-col gap-[12px]">
                {pending.map((message) => (
                  <PendingCard
                    key={message.id}
                    message={message}
                    now={now}
                    onConfirm={handleConfirm}
                    onOpen={handleOpen}
                    leaving={leavingIds.has(message.id)}
                  />
                ))}
              </div>
            )}
          </>
        ) : groups.length === 0 ? (
          error ? null : (
            <p className="py-[24px] text-center text-[14px] text-gray-60">Nothing confirmed yet</p>
          )
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <p className="mt-[20px] mb-[8px] text-[12px] font-bold uppercase tracking-[0.08em] text-gray-60">
                {group.label}
              </p>
              <div className="flex flex-col gap-[10px]">
                {group.items.map((message) => (
                  <ConfirmedRow key={message.id} message={message} showDate={group.label !== 'TODAY'} />
                ))}
              </div>
            </div>
          ))
        )}
        </div>
      </div>
    </div>
  );
}
