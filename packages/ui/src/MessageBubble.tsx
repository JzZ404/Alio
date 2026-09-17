'use client';

import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { MessageStatusLine } from './MessageStatusLine';
import type { ThreadMessage } from './messaging/types';

/** How long a press must hold before it counts as a long-press (spec §2.4). */
const LONG_PRESS_MS = 450;

/**
 * A live chat message. The primary Pending surface (spec §2.3).
 *
 * State lives in the line *under* the bubble, not in it (design 2026-09-17):
 * a marked message is still an ordinary message, so it keeps the ordinary
 * bubble and `MessageStatusLine` says what became of it. The tinted surface
 * is now only what the recipient must act on — it marks the one bubble
 * carrying a Confirm button, rather than every marked message on both sides.
 *
 * `showStatus` is false for all but the last message of a stack, so a burst
 * of messages sent together reads as one turn with one timestamp.
 *
 * Confirm renders only when `onConfirm` is passed, so a screen that cannot
 * confirm never shows a dead button.
 *
 * `onLongPress` opens the action sheet (spec §2.4): a 450ms pointer hold, or
 * a desktop right-click so the interaction is testable without a touch
 * device. It reports the bubble's own `getBoundingClientRect()` alongside
 * the message, so the caller can open the sheet at the message's actual
 * position instead of centring it. A bubble without `onLongPress` behaves
 * exactly as it does today.
 *
 * There is deliberately no "held" treatment while the sheet is open. A ring
 * with an offset paints a white gap around the bubble, and because the lifted
 * copy sits exactly over the original, the original's ring leaked out around
 * its edges as a white outline. The lift and the blur already say which
 * message is held; the bubble itself should just look like the bubble.
 *
 * `lifted` is for that copy. In the thread this component fills the row and
 * the bubble takes at most 75% of it; the action sheet instead renders it
 * into a wrapper already sized to the bubble's own measured width, where
 * `max-w-[75%]` would mean 75% of the bubble — squeezing the text into a
 * narrower, taller shape the instant you pressed it. `lifted` fills the
 * wrapper instead, so the copy is the same size as the thing you pressed.
 */
export function MessageBubble({
  message,
  viewerId,
  onConfirm,
  onLongPress,
  highlighted = false,
  lifted = false,
  showStatus = true,
}: {
  message: ThreadMessage;
  viewerId: string;
  onConfirm?: (messageId: string) => void;
  onLongPress?: (message: ThreadMessage, rect: DOMRect) => void;
  highlighted?: boolean;
  lifted?: boolean;
  showStatus?: boolean;
}) {
  const isMine = message.senderId === viewerId;
  const needsResponse = message.finalTier === 'action';
  const confirmed = message.acknowledgedAt !== null;
  const canConfirm =
    onConfirm !== undefined && needsResponse && !confirmed && message.recipientId === viewerId;

  const bubbleRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPressTimer = () => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const startPressTimer = () => {
    if (!onLongPress) return;
    clearPressTimer();
    pressTimer.current = setTimeout(() => {
      const rect = bubbleRef.current?.getBoundingClientRect();
      if (rect) onLongPress(message, rect);
    }, LONG_PRESS_MS);
  };

  // If the thread unmounts (navigating away, a live update reordering the
  // list) mid-hold, the timer must not fire afterward against a stale
  // `message`/`onLongPress` closure.
  useEffect(() => clearPressTimer, []);

  return (
    <div
      data-message-id={message.id}
      className={clsx('flex flex-col', isMine ? 'items-end' : 'items-start')}
    >
      <div
        ref={bubbleRef}
        onPointerDown={startPressTimer}
        onPointerUp={clearPressTimer}
        onPointerLeave={clearPressTimer}
        onPointerCancel={clearPressTimer}
        onContextMenu={(e) => {
          if (!onLongPress) return;
          e.preventDefault();
          onLongPress(message, e.currentTarget.getBoundingClientRect());
        }}
        className={clsx(
          'rounded-[20px] px-[14px] py-[12px] transition-shadow duration-300',
          lifted ? 'w-full' : 'max-w-[75%]',
          isMine ? 'rounded-tr-[6px]' : 'rounded-tl-[6px]',
          // Tinted only where it is an instruction. For everyone else a
          // marked message looks like a message and the status line below
          // carries the state.
          canConfirm
            ? 'border border-attention-border bg-attention-surface text-attention-text'
            : isMine
              ? 'bg-brand-primary text-white'
              : 'bg-white text-gray-100',
          // Jumped-to from the Pending list: brand accent, thick enough to
          // register — the accent green is only 1.3:1 against these surfaces.
          highlighted && 'ring-[3px] ring-brand-accent ring-offset-2',
        )}
      >
        <p className="whitespace-pre-wrap text-[14px] leading-snug">{message.text}</p>
        {canConfirm && (
          <button
            type="button"
            onClick={() => onConfirm?.(message.id)}
            // brand-active, not brand-primary: white on primary is 4.35:1 and
            // misses AA; on active it is 5.18:1.
            className="mt-[10px] h-[38px] w-full rounded-lg bg-brand-active text-[14px] font-bold text-white transition-colors active:bg-brand-primary"
          >
            Confirm
          </button>
        )}
      </div>
      {showStatus && <MessageStatusLine message={message} viewerId={viewerId} />}
    </div>
  );
}
