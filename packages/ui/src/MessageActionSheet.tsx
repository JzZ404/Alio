'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { IconPinFilled } from './icons';
import { MessageBubble } from './MessageBubble';
import type { ThreadMessage } from './messaging/types';

/** Gap between the lifted message and the menu that rises from it. */
const MENU_GAP = 10;
/** Keep the menu (or its flip to above) this far from the frame's edges. */
const FRAME_MARGIN = 12;
/** The menu's own width — independent of the pressed message's, which can be much narrower. */
const MENU_WIDTH = 240;
/**
 * Cap on the lifted copy's own height, as a fraction of the frame's height.
 * Bounding it makes overlap with the menu impossible by construction rather
 * than merely unlikely: an uncapped copy could be tall enough that neither
 * "below" nor "above" has room, forcing the menu into the copy's own space.
 * A capped preview still shows the opening lines; the full text is still in
 * the thread behind the blur.
 */
const COPY_MAX_HEIGHT_RATIO = 0.4;
/** Matches `sheet-out`/`backdrop-out` in the theme preset. */
const EXIT_MS = 160;

/**
 * Closing should be felt, not waited for. When the system asks for less
 * motion the exit is instant, so the delay that lets it play goes too —
 * otherwise the menu just sits there for a beat doing nothing.
 */
function exitDuration(): number {
  if (typeof window === 'undefined' || !window.matchMedia) return EXIT_MS;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : EXIT_MS;
}

/**
 * Long-press action sheet (spec §2.4). Opened by pressing a message; the
 * thread blurs behind it and the pressed message's own `MessageBubble` is
 * lifted — inert, with no `onConfirm` or `onLongPress` — to the message's
 * own position, supplied by the caller as `anchor` and measured from the
 * pressed bubble's own `getBoundingClientRect()`. The menu rises directly
 * below it. Nothing is centred, so nothing appears to jump.
 *
 * Rendering the real `MessageBubble` here (rather than a hand-rolled copy)
 * means an already-marked message's tinted surface and Pending/Confirmed
 * header can never drift from what the real bubble underneath shows — the
 * two are, literally, the same component.
 *
 * If the menu would run past the bottom of the frame it rises above the
 * message instead. The lifted copy's height is capped (see
 * `COPY_MAX_HEIGHT_RATIO`) before that decision is made, and the "neither
 * fits" fallback always prefers a position that cannot overlap the copy, so
 * the menu and the lifted copy can never occupy the same space.
 *
 * Renders nothing when `message` or `anchor` is null, so a screen can always
 * mount this and just drive it with state.
 */
export function MessageActionSheet({
  message,
  anchor,
  viewerId,
  onMarkPending,
  onUnmarkPending,
  onReply,
  onCopy,
  onClose,
}: {
  message: ThreadMessage | null;
  anchor: { top: number; left: number; width: number } | null;
  viewerId: string;
  onMarkPending: (message: ThreadMessage) => void;
  onUnmarkPending: (message: ThreadMessage) => void;
  onReply: (message: ThreadMessage) => void;
  onCopy: (message: ThreadMessage) => void;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const [copyMaxHeight, setCopyMaxHeight] = useState<number | null>(null);
  // Set the instant something dismisses the sheet, so the exit can play
  // before the parent unmounts it. Every way out goes through `dismiss`.
  const [closing, setClosing] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [block, setBlock] = useState<{ top: number; placement: 'below' | 'above' } | null>(null);

  // A fresh message means a fresh sheet, even if the last one was mid-exit.
  useEffect(() => {
    setClosing(false);
    return () => {
      if (exitTimer.current !== null) clearTimeout(exitTimer.current);
    };
  }, [message?.id]);

  /**
   * Play the exit, then do the thing. Actions run *after* the animation, not
   * beside it: tapping Mark and watching the menu leave before the bubble
   * changes reads as one movement rather than two things happening at once.
   */
  const dismiss = (then: () => void) => {
    if (closing) return;
    setClosing(true);
    exitTimer.current = setTimeout(then, exitDuration());
  };

  useEffect(() => {
    if (!message) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss(onClose);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, onClose, closing]);

  // Where the menu block (menu card + reassurance line) lands depends on how
  // tall the lifted copy and the block itself actually render — both vary
  // with message length and marked state — so this measures them post-layout
  // rather than guessing. Runs before paint, so a flip to "above" never
  // flashes the "below" position first.
  useLayoutEffect(() => {
    if (!message || !anchor || !overlayRef.current || !copyRef.current || !blockRef.current) {
      setCopyMaxHeight(null);
      setBlock(null);
      return;
    }
    const frameHeight = overlayRef.current.clientHeight;
    // Cap first: the below/above decision below only ever has to reason
    // about a bounded copy height, never an arbitrary one.
    const cappedCopyHeight = frameHeight * COPY_MAX_HEIGHT_RATIO;
    setCopyMaxHeight(cappedCopyHeight);
    const copyHeight = Math.min(copyRef.current.offsetHeight, cappedCopyHeight);
    const blockHeight = blockRef.current.offsetHeight;

    const copyBottom = anchor.top + copyHeight;
    const below = copyBottom + MENU_GAP;
    const fitsBelow = below + blockHeight <= frameHeight - FRAME_MARGIN;

    const aboveTop = anchor.top - blockHeight - MENU_GAP;
    const fitsAbove = aboveTop >= FRAME_MARGIN;

    if (fitsBelow) {
      setBlock({ top: below, placement: 'below' });
    } else if (fitsAbove) {
      setBlock({ top: aboveTop, placement: 'above' });
    } else {
      // Neither placement has room to spare — only possible with a very
      // short frame or an oversized menu. "below" is the safer of the two
      // failures: it can only run past the frame's bottom edge, never back
      // into the copy sitting above it, which "above" clamped to
      // FRAME_MARGIN could do.
      setBlock({ top: below, placement: 'below' });
    }
  }, [message, anchor]);

  if (!message || !anchor) return null;

  const alreadyMarked = message.finalTier !== null;
  // Once Sarah has Confirmed, she has acted on it: the mark is hers now, and
  // the database has no transition that takes it back either.
  const canUnmark = alreadyMarked && message.acknowledgedAt === null;

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
      data-testid="action-sheet-overlay"
      className={clsx(
        'absolute inset-0 z-50 bg-gray-100/20 backdrop-blur-md',
        closing ? 'animate-backdrop-out' : 'animate-backdrop-in',
      )}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => dismiss(onClose)}
        className="absolute inset-0 cursor-default"
      />

      {/* The pressed message's own bubble, lifted in place — not centred,
          and not a hand-rolled copy, so an already-marked message's tinted
          surface and header can never drift from what's shown here. Height
          is capped so a long message can never crowd out the menu. */}
      <div
        ref={copyRef}
        data-testid="lifted-message"
        style={{
          top: anchor.top,
          left: anchor.left,
          width: anchor.width,
          maxHeight: copyMaxHeight ?? undefined,
        }}
        className={clsx(
          'absolute overflow-hidden',
          // The held message lifts towards you and settles back on release,
          // so the gesture feels like picking it up rather than a blur
          // appearing around it.
          closing ? 'animate-message-drop' : 'animate-message-lift',
        )}
      >
        {/* No status line in the lift: the wrapper is the bubble's own
            width, so the line would wrap, and the menu below already says
            what can be done with it. */}
        <MessageBubble message={message} viewerId={viewerId} lifted showStatus={false} />
      </div>

      <div
        ref={blockRef}
        data-testid="action-sheet-menu-block"
        style={{
          top: block?.top ?? anchor.top,
          left: blockLeft,
          width: MENU_WIDTH,
          visibility: block ? 'visible' : 'hidden',
        }}
        className="absolute flex flex-col gap-[10px]"
      >
        {/* The card is a container with padding, not a stack of full-bleed
            rows: the primary action sits inside it as its own rounded box
            (design 2026-09-17), which is why there are no dividers — the
            green box is what separates it from the plain actions. */}
        <div
          className={clsx(
            'rounded-[24px] bg-white p-[8px]',
            closing ? 'animate-sheet-out' : 'animate-sheet-in',
            block?.placement === 'above' ? 'origin-bottom' : 'origin-top',
          )}
        >
          {!alreadyMarked && (
            <button
              type="button"
              onClick={() => dismiss(() => onMarkPending(message))}
              className="flex w-full items-center gap-[10px] rounded-[16px] bg-brand-accent px-[14px] py-[14px] text-left text-[16px] transition-transform active:scale-[0.97] font-bold text-gray-100"
            >
              <IconPinFilled aria-hidden className="size-[18px]" />
              Mark as Pending
            </button>
          )}
          {/* A long-press is easy to hit by accident, so the menu that marks
              a message is also where it is taken back. Plain, not the green
              box: undoing is a correction, and only one action in the card
              should read as "do this". */}
          {canUnmark && (
            <button
              type="button"
              onClick={() => dismiss(() => onUnmarkPending(message))}
              className="flex w-full items-center gap-[10px] px-[14px] py-[14px] text-left text-[16px] transition-transform active:scale-[0.97] font-bold text-gray-100"
            >
              <IconPinFilled aria-hidden className="size-[18px] text-brand-primary" />
              Unmark as Pending
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(() => onReply(message))}
            className="flex w-full items-center px-[14px] py-[14px] text-left text-[16px] transition-transform active:scale-[0.97] text-gray-100"
          >
            Reply
          </button>
          <button
            type="button"
            onClick={() => dismiss(() => onCopy(message))}
            className="flex w-full items-center px-[14px] py-[14px] text-left text-[16px] transition-transform active:scale-[0.97] text-gray-100"
          >
            Copy text
          </button>
        </div>

        {/* On its own subtle surface rather than floating directly on the
            blur, which left it hard to read. */}
        <div className="flex justify-center">
          <p className="rounded-full bg-white/70 px-[12px] py-[6px] text-[12px] text-gray-60">
            Sarah Confirms it when she sees it
          </p>
        </div>
      </div>
    </div>
  );
}
