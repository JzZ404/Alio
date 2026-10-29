'use client';

import { useEffect, useRef } from 'react';
import { IconArrowUp, IconClose } from './icons';
import { DISPLAY_NAME } from './messaging/participants';
import type { ThreadMessage } from './messaging/types';

/**
 * The composer while a reply is being written (design 2026-09-17). Replaces
 * the ordinary composer rather than sitting above it: quoting takes the whole
 * bottom of the screen, on its own white surface, and the quick actions step
 * aside because they are not what you are doing.
 *
 * The quote card names who is being answered — "Replying to you" when it is
 * the viewer's own message — and shows one line of it, so a long message
 * cannot push the input off screen.
 *
 * **The reply relationship is presentational.** `family_messages` has no
 * parent-message column, so sending here sends an ordinary message and the
 * quote is gone on reload. Adding a real thread means a schema change and a
 * decision about how the caregiver's side renders it; both are unspecified
 * (spec section 2.4 lists Reply without defining it).
 */
export function ReplyComposer({
  replyingTo,
  viewerId,
  value,
  onChange,
  onSend,
  onCancel,
}: {
  replyingTo: ThreadMessage;
  viewerId: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Tapping Reply should put the cursor where the reply goes. Without this
  // the menu closes onto a composer that looks ready and is not, and on a
  // phone the keyboard never comes up.
  useEffect(() => {
    inputRef.current?.focus();
  }, [replyingTo.id]);

  // The plain first name, not `personLabel`'s "Sarah · Caregiver": this line
  // is one half of a sentence, not a directory entry.
  const who =
    replyingTo.senderId === viewerId
      ? 'you'
      : (replyingTo.senderId && DISPLAY_NAME[replyingTo.senderId]) || replyingTo.senderName;

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-[28px] bg-white px-[16px] pb-[20px] pt-[16px]">
      <div className="rounded-[16px] bg-brand-tint-1 px-[16px] py-[12px]">
        <div className="flex items-start justify-between gap-[12px]">
          <p className="text-[14px] font-bold text-gray-60">Replying to {who}</p>
          <button
            type="button"
            aria-label="Cancel reply"
            onClick={onCancel}
            className="-mr-[4px] -mt-[2px] flex size-[24px] shrink-0 items-center justify-center text-gray-60"
          >
            <IconClose className="size-[18px]" />
          </button>
        </div>
        {/* One line only: the message being answered is context, and the
            thread above still holds the whole thing. */}
        <p className="mt-[4px] truncate text-[14px] text-gray-100">{replyingTo.text}</p>
      </div>

      <div className="mt-[12px] flex items-center gap-[10px]">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // isComposing: Enter that commits an IME candidate must not send.
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSend();
          }}
          aria-label="Reply"
          className="h-[48px] flex-1 rounded-full bg-brand-tint-1 px-[16px] text-[15px] text-gray-100 placeholder:text-gray-60 outline-none"
        />
        <button
          type="button"
          aria-label="Send reply"
          onClick={onSend}
          className="flex size-[48px] shrink-0 items-center justify-center rounded-full bg-brand-tint-1 transition-colors active:bg-brand-border"
        >
          <IconArrowUp className="size-[22px] text-brand-primary" />
        </button>
      </div>
    </div>
  );
}
