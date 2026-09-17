'use client';

import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { IconAttention } from './icons';
import type { ThreadMessage } from './messaging/types';

/** How long a press must hold before it counts as a long-press (spec §2.4). */
const LONG_PRESS_MS = 450;

/**
 * A live chat message. The primary Pending surface (spec §2.3): a
 * "Pending" message carries its Confirm button in the bubble, and both
 * sides see the state — the recipient gets Confirm, the sender sees Pending,
 * everyone sees Confirmed.
 *
 * Confirm renders only when `onConfirm` is passed, so a screen that cannot
 * confirm never shows a dead button.
 *
 * `onLongPress` opens the action sheet (spec §2.4): a 450ms pointer hold, or
 * a desktop right-click so the interaction is testable without a touch
 * device. A bubble without `onLongPress` behaves exactly as it does today.
 */
export function MessageBubble({
  message,
  viewerId,
  onConfirm,
  onLongPress,
  highlighted = false,
}: {
  message: ThreadMessage;
  viewerId: string;
  onConfirm?: (messageId: string) => void;
  onLongPress?: (message: ThreadMessage) => void;
  highlighted?: boolean;
}) {
  const isMine = message.senderId === viewerId;
  const needsResponse = message.finalTier === 'action';
  const confirmed = message.acknowledgedAt !== null;
  const canConfirm =
    onConfirm !== undefined && needsResponse && !confirmed && message.recipientId === viewerId;

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
    pressTimer.current = setTimeout(() => onLongPress(message), LONG_PRESS_MS);
  };

  // If the thread unmounts (navigating away, a live update reordering the
  // list) mid-hold, the timer must not fire afterward against a stale
  // `message`/`onLongPress` closure.
  useEffect(() => clearPressTimer, []);

  return (
    <div
      data-message-id={message.id}
      className={clsx('flex', isMine ? 'justify-end' : 'justify-start')}
    >
      <div
        onPointerDown={startPressTimer}
        onPointerUp={clearPressTimer}
        onPointerLeave={clearPressTimer}
        onPointerCancel={clearPressTimer}
        onContextMenu={(e) => {
          if (!onLongPress) return;
          e.preventDefault();
          onLongPress(message);
        }}
        className={clsx(
          'max-w-[75%] rounded-[20px] px-[14px] py-[12px] transition-shadow duration-300',
          isMine ? 'rounded-tr-[6px]' : 'rounded-tl-[6px]',
          needsResponse
            ? 'border border-attention-border bg-attention-surface text-attention-text'
            : isMine
              ? 'bg-brand-primary text-white'
              : 'bg-white text-gray-100',
          // Jumped-to from the Pending list: brand accent, thick enough to
          // register — the accent green is only 1.3:1 against these surfaces.
          highlighted && 'ring-[3px] ring-brand-accent ring-offset-2',
        )}
      >
        {/*
         * One line states the state, so it cannot contradict itself: this
         * used to be a separate "Confirmed" line below the Confirm button,
         * left in place after the header above it kept reading "Pending" —
         * both were visible on the same bubble once acknowledged.
         */}
        {needsResponse && (
          <p className="mb-[6px] flex items-center gap-[6px] text-[12px] font-bold">
            <IconAttention aria-hidden className="size-[16px] text-brand-primary" />
            {confirmed ? 'Confirmed' : 'Pending'}
          </p>
        )}
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
    </div>
  );
}
