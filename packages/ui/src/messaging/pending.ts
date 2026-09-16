import type { ThreadMessage } from './types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Compare instants, not strings: Supabase writes "+00:00", toISOString() writes "Z". */
const instant = (iso: string) => Date.parse(iso);

/** An unconfirmed, human-tagged "Needs response" message addressed to this user. */
export function isPendingFor(m: ThreadMessage, userId: string): boolean {
  return m.recipientId === userId && m.finalTier === 'action' && m.acknowledgedAt === null;
}

/** The Pending view (spec §1): longest-waiting first. */
export function selectPending(messages: ThreadMessage[], userId: string): ThreadMessage[] {
  return messages
    .filter((m) => isPendingFor(m, userId))
    .sort((a, b) => instant(a.createdAt) - instant(b.createdAt));
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

/** Chat pinned bar (spec §2.2): count plus the longest-waiting item. Null hides the bar. */
export function pinnedBarLabel(messages: ThreadMessage[], userId: string): string | null {
  const pending = selectPending(messages, userId);
  if (pending.length === 0) return null;
  return `${pending.length} pending · ${pending[0].text}`;
}

export function formatMessageTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

/**
 * Insert or replace by id, keeping chronological order, so realtime echoes of
 * our own writes are harmless. Confirmation is one-way: an event that arrives
 * late carrying acknowledged_at = null must not undo it.
 */
export function mergeMessage(list: ThreadMessage[], next: ThreadMessage): ThreadMessage[] {
  const prev = list.find((m) => m.id === next.id);
  const merged =
    prev?.acknowledgedAt && !next.acknowledgedAt
      ? { ...next, acknowledgedAt: prev.acknowledgedAt }
      : next;
  return [...list.filter((m) => m.id !== next.id), merged].sort(
    (a, b) => instant(a.createdAt) - instant(b.createdAt),
  );
}

/** "Oldest: 5h" for the section header. Null when nothing is pending. */
export function oldestWaitingLabel(pending: ThreadMessage[], now: Date): string | null {
  const oldest = pending[0];
  if (!oldest) return null;
  return `Oldest: ${waitingLabel(oldest.createdAt, now).replace('Waiting ', '')}`;
}

/** "Waiting since 9:14 AM" for the Inbox card. Null when nothing is pending. */
export function waitingSinceLabel(pending: ThreadMessage[], timeZone?: string): string | null {
  const oldest = pending[0];
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
