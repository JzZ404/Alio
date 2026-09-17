'use client';

import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { IconCheck, IconPinFilled } from './icons';
import { formatMessageTime } from './messaging/pending';
import { messageStatus } from './messaging/stacking';
import type { ThreadMessage } from './messaging/types';

/**
 * The line under a message saying where it got to (design 2026-09-17).
 *
 * This replaced tinting the bubble itself and putting the word inside it. A
 * marked message is still an ordinary message — the state is something that
 * happened *to* it, so it belongs beside the timestamp rather than inside the
 * thing the person wrote.
 *
 * Three states, and a fourth that is only a time:
 * - `sent` — your own message, nothing has happened to it yet.
 * - `pending` — marked, waiting on the caregiver.
 * - `confirmed` — the caregiver has said they have it.
 * - a message you received carries a time and no word, because "Sent" is the
 *   sender's claim to make and the other two have their own icons.
 *
 * Only the last message of a stack renders one; see `endsStack`.
 *
 * The line animates when the state changes *under* it — Sent becoming
 * Pending, Pending becoming Confirmed — and not on first render, so opening
 * a thread does not set every line in it moving at once.
 */
export function MessageStatusLine({
  message,
  viewerId,
}: {
  message: ThreadMessage;
  viewerId: string;
}) {
  const status = messageStatus(message, viewerId);
  const isMine = message.senderId === viewerId;
  const time = formatMessageTime(message.createdAt);

  // Compared during render, recorded after it: the render that first sees a
  // new status is the one that has to carry the animation class.
  const lastStatus = useRef(status);
  const changed = lastStatus.current !== status;
  useEffect(() => {
    lastStatus.current = status;
  }, [status]);

  return (
    <div
      className={clsx(
        'flex items-center gap-[6px] px-[4px] pt-[5px] text-[12px]',
        isMine ? 'self-end' : 'self-start',
        changed && 'animate-status-in',
      )}
    >
      {status === 'confirmed' && (
        <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-brand-accent">
          <IconCheck aria-hidden className="size-[11px] text-gray-100" />
        </span>
      )}
      {status === 'pending' && (
        <IconPinFilled aria-hidden className="size-[14px] shrink-0 text-brand-primary" />
      )}

      {status === 'pending' && <span className="font-bold text-brand-primary">Pending</span>}
      {status === 'confirmed' && <span className="text-gray-100">Confirmed</span>}
      {status === 'sent' && <span className="text-gray-60">Sent</span>}

      {/* The separator belongs to the word, not the time: a received message
          shows the time alone, with nothing dangling in front of it. */}
      <span className="text-gray-60">
        {status === 'none' ? time : `· ${time}`}
      </span>
    </div>
  );
}
