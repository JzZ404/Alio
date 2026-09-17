'use client';

import { useEffect } from 'react';
import { IconPinFilled } from './icons';
import type { ThreadMessage } from './messaging/types';

/**
 * Long-press action sheet (spec §2.4). Opened by pressing a message; the
 * thread blurs behind it and the pressed message is lifted above the menu in
 * its own bubble treatment so it stays readable while marking it.
 *
 * Renders nothing when `message` is null, so a screen can always mount this
 * and just drive it with state.
 */
export function MessageActionSheet({
  message,
  onMarkPending,
  onCopy,
  onClose,
}: {
  message: ThreadMessage | null;
  onMarkPending: (message: ThreadMessage) => void;
  onCopy: (message: ThreadMessage) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [message, onClose]);

  if (!message) return null;

  const alreadyMarked = message.finalTier !== null;

  return (
    // Scoped to the screen with `absolute inset-0`, not `fixed`: every other
    // full-screen overlay in this app (e.g. AddRecordModal) does the same, so
    // it covers the MobileFrame's screen area rather than the whole browser
    // viewport around it in the dev preview.
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-[12px] bg-gray-100/20 px-[24px] backdrop-blur-md">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />

      <div className="relative flex w-full justify-end">
        <p className="max-w-[75%] rounded-[20px] rounded-tr-[6px] bg-brand-primary px-[14px] py-[12px] text-[14px] leading-snug text-white">
          {message.text}
        </p>
      </div>

      <div className="relative w-full max-w-[260px] overflow-hidden rounded-[16px] bg-white">
        {!alreadyMarked && (
          <button
            type="button"
            onClick={() => onMarkPending(message)}
            className="flex w-full items-center gap-[10px] bg-brand-accent px-[16px] py-[14px] text-left text-[16px] font-bold text-gray-100"
          >
            <IconPinFilled aria-hidden className="size-[18px]" />
            Mark as Pending
          </button>
        )}
        {/*
         * Reply is deliberately inert: threaded replies are unspecified
         * everywhere in the design, and the user asked to keep the item
         * visible in the menu rather than remove it. It calls nothing.
         */}
        <button
          type="button"
          className="flex w-full items-center border-t border-gray-30 px-[16px] py-[14px] text-left text-[16px] text-gray-100"
        >
          Reply
        </button>
        <button
          type="button"
          onClick={() => onCopy(message)}
          className="flex w-full items-center border-t border-gray-30 px-[16px] py-[14px] text-left text-[16px] text-gray-100"
        >
          Copy text
        </button>
      </div>

      <p className="relative text-[12px] text-gray-60">Sarah Confirms it when she sees it</p>
    </div>
  );
}
