import type { ThreadMessage } from './types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Compare instants, not strings: Supabase writes "+00:00", toISOString() writes "Z". */
const instant = (iso: string) => Date.parse(iso);

/** An unconfirmed, human-tagged Pending message addressed to this user. */
export function isPendingFor(m: ThreadMessage, userId: string): boolean {
  return m.recipientId === userId && m.finalTier === 'action' && m.acknowledgedAt === null;
}

/** The Pending view (spec §1, revised 2026-09-17): newest first. */
export function selectPending(messages: ThreadMessage[], userId: string): ThreadMessage[] {
  return messages
    .filter((m) => isPendingFor(m, userId))
    .sort((a, b) => instant(b.createdAt) - instant(a.createdAt));
}

/** The collapsed Confirmed section (spec §3): last `days` days, most recently confirmed first. */
export function selectRecentlyConfirmed(
  messages: ThreadMessage[],
  userId: string,
  now: Date,
  days = 7,
): ThreadMessage[] {
  const cutoff = now.getTime() - days * DAY_MS;
  return messages
    .filter(
      (m): m is ThreadMessage & { acknowledgedAt: string } =>
        m.recipientId === userId &&
        m.finalTier === 'action' &&
        m.acknowledgedAt !== null &&
        instant(m.acknowledgedAt) >= cutoff,
    )
    .sort((a, b) => instant(b.acknowledgedAt) - instant(a.acknowledgedAt));
}

/** Bell badge text (spec §2.1): hidden at zero, capped at 9+. */
export function formatBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? '9+' : String(count);
}

const MINUTE_MS = 60 * 1000;

/**
 * "Waiting 40m" below an hour, "Waiting 3h" above it (spec §3, revised
 * 2026-09-16 — it used to stay silent under two hours, which the screens
 * contradict). Never below a minute: a fresh item still reads as waiting.
 */
export function waitingLabel(createdAt: string, now: Date): string {
  const elapsed = Math.max(now.getTime() - instant(createdAt), MINUTE_MS);
  const minutes = Math.floor(elapsed / MINUTE_MS);
  return minutes < 60 ? `Waiting ${minutes}m` : `Waiting ${Math.floor(minutes / 60)}h`;
}

/** "Sep 15" — shown on confirmed rows outside today, where the time alone is ambiguous. */
export function formatMessageDate(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone });
}

export function formatMessageTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

/**
 * Confirmation is one-way in the database — confirmed once, never
 * un-confirmed, there is no transition for it — so it is one-way here too.
 * The initial load runs only after the channel reports SUBSCRIBED, so a
 * realtime UPDATE can be applied before the snapshot row it supersedes is
 * read, and a Confirm landing in that window would otherwise be reverted
 * locally until the next event.
 *
 * **`finalTier` is deliberately not guarded here.** It used to be, when a
 * mark could never be taken back. Un-marking (design 2026-09-17) made that
 * guard actively wrong: it would swallow the un-mark on every screen that
 * did not perform it — most importantly the caregiver's, who would go on
 * seeing Pending for a message the family had withdrawn.
 *
 * The stale-snapshot race `finalTier` needed protection from is handled
 * where it actually lives instead: `useFamilyMessages` lets a live event win
 * over a snapshot row for the same message, which is correct in *both*
 * directions rather than only the one a one-way field allows.
 *
 * A row that ends up `finalTier: null` with `acknowledgedAt` set is rejected
 * by `isPendingFor` *and* by `selectRecentlyConfirmed` — it would fall out of
 * both lists and never be seen again — so that combination stays impossible:
 * the database has no transition that un-marks a confirmed message, and
 * `unmarkPending` filters on `acknowledged_at is null`.
 */
export function keepOneWayFields(prev: ThreadMessage, next: ThreadMessage): ThreadMessage {
  return {
    ...next,
    acknowledgedAt: next.acknowledgedAt ?? prev.acknowledgedAt,
  };
}

/**
 * Insert or replace by id, keeping chronological order, so realtime echoes of
 * our own writes are harmless — and so a late event cannot undo a tag or a
 * confirmation (`keepOneWayFields`).
 */
export function mergeMessage(list: ThreadMessage[], next: ThreadMessage): ThreadMessage[] {
  const prev = list.find((m) => m.id === next.id);
  const merged = prev ? keepOneWayFields(prev, next) : next;
  return [...list.filter((m) => m.id !== next.id), merged].sort(
    (a, b) => instant(a.createdAt) - instant(b.createdAt),
  );
}

/**
 * The item that has been waiting longest, independent of list order. Used
 * anywhere a "waiting since" label or a "jump to the oldest" action needs
 * the true oldest member of a list that may not be sorted that way — e.g.
 * the Pending list (newest-first) and the family Care Circle's "See all".
 */
export function findOldest(pending: ThreadMessage[]): ThreadMessage | null {
  return pending.reduce<ThreadMessage | null>(
    (oldest, m) => (oldest === null || instant(m.createdAt) < instant(oldest.createdAt) ? m : oldest),
    null,
  );
}

/**
 * "Oldest: 5h" for the section header. Reads the oldest item regardless of
 * list order — `selectPending` is newest-first, so this must not index [0].
 * Null when nothing is pending.
 */
export function oldestWaitingLabel(pending: ThreadMessage[], now: Date): string | null {
  const oldest = findOldest(pending);
  if (!oldest) return null;
  return `Oldest: ${waitingLabel(oldest.createdAt, now).replace('Waiting ', '')}`;
}

/**
 * "Waiting since 9:14 AM" for the Inbox card. Reads the oldest item
 * regardless of list order, for the same reason as `oldestWaitingLabel`.
 * Null when nothing is pending.
 */
export function waitingSinceLabel(pending: ThreadMessage[], timeZone?: string): string | null {
  const oldest = findOldest(pending);
  if (!oldest) return null;
  return `Waiting since ${formatMessageTime(oldest.createdAt, timeZone)}`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** How recent the newest confirmation is, for the Inbox card. */
export function confirmedRecencyLabel(confirmed: ThreadMessage[], now: Date): string | null {
  const newest = confirmed[0];
  if (!newest?.acknowledgedAt) return null;
  const days = Math.round((startOfDay(now) - startOfDay(new Date(newest.acknowledgedAt))) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return 'Earlier';
}

export type ConfirmedGroup = { label: 'TODAY' | 'YESTERDAY' | 'EARLIER'; items: ThreadMessage[] };

/** Confirmed rows grouped by calendar day, newest first, empty groups dropped. */
export function groupConfirmedByDay(confirmed: ThreadMessage[], now: Date): ConfirmedGroup[] {
  const buckets: ConfirmedGroup[] = [
    { label: 'TODAY', items: [] },
    { label: 'YESTERDAY', items: [] },
    { label: 'EARLIER', items: [] },
  ];
  const sorted = [...confirmed].sort(
    (a, b) => instant(b.acknowledgedAt ?? b.createdAt) - instant(a.acknowledgedAt ?? a.createdAt),
  );
  for (const m of sorted) {
    const days = Math.round((startOfDay(now) - startOfDay(new Date(m.acknowledgedAt ?? m.createdAt))) / DAY_MS);
    const bucket = days <= 0 ? buckets[0] : days === 1 ? buckets[1] : buckets[2];
    bucket.items.push(m);
  }
  return buckets.filter((b) => b.items.length > 0);
}
