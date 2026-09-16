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

/** "Waiting 5 hours", only once two hours have passed (spec §3). */
export function waitingLabel(createdAt: string, now: Date): string | null {
  const hours = Math.floor((now.getTime() - instant(createdAt)) / HOUR_MS);
  return hours >= 2 ? `Waiting ${hours} hours` : null;
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
