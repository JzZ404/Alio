import type { ThreadMessage } from './types';

/**
 * Messages sent closer together than this, by the same person, read as one
 * burst rather than separate turns, so only the last of them carries a status
 * line (design 2026-09-17, the iMessage behaviour).
 *
 * A minute is long enough to catch "…and one more thing" and short enough
 * that a reply half an hour later still gets its own timestamp.
 */
export const STACK_WINDOW_MS = 60_000;

/**
 * Does `current` end a stack — i.e. should it carry the status line?
 *
 * True when it is the last message, when the next one is from someone else,
 * or when the next one is far enough away in time to be a separate turn.
 *
 * Exported as a two-message predicate rather than a whole-list pass because
 * threads render one message at a time and a list pass would have to be
 * recomputed on every realtime event.
 */
export function endsStack(current: ThreadMessage, next: ThreadMessage | undefined): boolean {
  if (!next) return true;
  if (next.senderId !== current.senderId) return true;
  const gap = new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime();
  // NaN (an unparseable date) fails this comparison, which ends the stack —
  // the safe direction, since a stray status line is a smaller mistake than
  // a message whose state is never shown.
  return !(gap < STACK_WINDOW_MS);
}

/**
 * What the status line says about a message, from `viewerId`'s side.
 *
 * `sent` is the sender's own word about their own message; a message you
 * received is just a message, so it carries a time and nothing else.
 */
export type MessageStatus = 'pending' | 'confirmed' | 'sent' | 'none';

export function messageStatus(message: ThreadMessage, viewerId: string): MessageStatus {
  if (message.finalTier === 'action') {
    return message.acknowledgedAt === null ? 'pending' : 'confirmed';
  }
  return message.senderId === viewerId ? 'sent' : 'none';
}
