'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { IconPinFilled } from './icons';
import type { ThreadMessage } from './messaging/types';

/** Gap between the lifted message and the menu that rises from it. */
const MENU_GAP = 10;
/** Keep the menu (or its flip to above) this far from the frame's edges. */
const FRAME_MARGIN = 12;
/** The menu's own width — independent of the pressed message's, which can be much narrower. */
const MENU_WIDTH = 240;

/**
 * Long-press action sheet (spec §2.4). Opened by pressing a message; the
 * thread blurs behind it and a lifted copy of the pressed message sits at
 * the message's own position — supplied by the caller as `anchor`, measured
 * from the pressed bubble's own `getBoundingClientRect()` — with the menu
 * rising directly below it. Nothing is centred, so nothing appears to jump.
 *
 * If the menu would run past the bottom of the frame it rises above the
 * message instead; both the lifted copy and the menu stay clamped inside
 * the frame either way.
 *
 * Renders nothing when `message` or `anchor` is null, so a screen can always
 * mount this and just drive it with state.
 */
export function MessageActionSheet({
  message,
  anchor,
  onMarkPending,
  onCopy,
  onClose,
}: {
  message: ThreadMessage | null;
  anchor: { top: number; left: number; width: number } | null;
  onMarkPending: (message: ThreadMessage) => void;
  onCopy: (message: ThreadMessage) => void;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLParagraphElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const [block, setBlock] = useState<{ top: number; placement: 'below' | 'above' } | null>(null);

  useEffect(() => {
    if (!message) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [message, onClose]);

  // Where the menu block (menu card + reassurance line) lands depends on how
  // tall the lifted copy and the block itself actually render — both vary
  // with message length and marked state — so this measures them post-layout
  // rather than guessing. Runs before paint, so a flip to "above" never
  // flashes the "below" position first.
  useLayoutEffect(() => {
    if (!message || !anchor || !overlayRef.current || !copyRef.current || !blockRef.current) {
      setBlock(null);
      return;
    }
    const frameHeight = overlayRef.current.clientHeight;
    const copyHeight = copyRef.current.offsetHeight;
    const blockHeight = blockRef.current.offsetHeight;
    const below = anchor.top + copyHeight + MENU_GAP;
    const fitsBelow = frameHeight === 0 || below + blockHeight <= frameHeight - FRAME_MARGIN;
    if (fitsBelow) {
      setBlock({ top: below, placement: 'below' });
    } else {
      setBlock({ top: Math.max(FRAME_MARGIN, anchor.top - blockHeight - MENU_GAP), placement: 'above' });
    }
  }, [message, anchor]);

  if (!message || !anchor) return null;

  const alreadyMarked = message.finalTier !== null;

  const frameWidth = overlayRef.current?.clientWidth ?? 0;
  const blockLeft =
    frameWidth > 0
      ? Math.min(Math.max(anchor.left, FRAME_MARGIN), frameWidth - MENU_WIDTH - FRAME_MARGIN)
      : anchor.left;

  return (
    // Scoped to the screen with `absolute inset-0`, not `fixed`: every other
    // full-screen overlay in this app (e.g. AddRecordModal) does the same, so
    // it covers the MobileFrame's screen area rather than the whole browser
    // viewport around it in the dev preview.
    <div
      ref={overlayRef}
      className="absolute inset-0 z-50 animate-backdrop-in bg-gray-100/20 backdrop-blur-md"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />

      {/* The pressed message, lifted in place — not centred. Its ring matches
          the one the real bubble underneath picks up via `selected`, so the
          two read as one object. */}
      <p
        ref={copyRef}
        style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
        className="absolute rounded-[20px] rounded-tr-[6px] bg-brand-primary px-[14px] py-[12px] text-[14px] leading-snug text-white ring-2 ring-brand-primary ring-offset-2"
      >
        {message.text}
      </p>

      <div
        ref={blockRef}
        style={{
          top: block?.top ?? anchor.top,
          left: blockLeft,
          width: MENU_WIDTH,
          visibility: block ? 'visible' : 'hidden',
        }}
        className="absolute flex flex-col gap-[10px]"
      >
        <div
          className={clsx(
            'animate-sheet-in overflow-hidden rounded-[16px] bg-white',
            block?.placement === 'above' ? 'origin-bottom' : 'origin-top',
          )}
        >
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

        <p className="text-center text-[12px] text-gray-60">Sarah Confirms it when she sees it</p>
      </div>
    </div>
  );
}
