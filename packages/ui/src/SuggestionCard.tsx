'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { IconRiVoiceAiFill } from './icons';

/**
 * The ALIO SUGGESTS card (spec §4, family design 2026-09-16). Rendered under
 * one of the family member's own untagged messages when the stubbed
 * `suggestsPending` heuristic thinks it needs Sarah. Real, but the suggestion
 * behind it is a stand-in until the classifier plan runs — see
 * `messaging/suggest.ts`.
 *
 * `onMark` and `onDismiss` both just report the answer; the caller owns what
 * happens next (marking Pending, or nothing at all). Either answer plays the
 * card out first — accepting it removes the card by making the message
 * tagged, so without this the card would vanish on the same frame as the tap
 * and the answer would never be seen to land.
 */
const EXIT_MS = 200;

export function SuggestionCard({
  onMark,
  onDismiss,
}: {
  onMark: () => void;
  onDismiss: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const answer = (then: () => void) => {
    if (leaving) return;
    setLeaving(true);
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(then, reduced ? 0 : EXIT_MS);
  };

  return (
    <div className="flex flex-col self-end">
      <div
        className={clsx(
          'mt-[8px] w-full max-w-[75%] self-end rounded-[18px] bg-gray-30/60 px-[16px] py-[14px]',
          leaving ? 'animate-card-out' : 'animate-card-in',
        )}
      >
        <p className="flex items-center gap-[6px] text-[12px] font-bold uppercase tracking-[0.08em] text-gray-60">
          <IconRiVoiceAiFill aria-hidden className="size-[14px]" />
          ALIO SUGGESTS
        </p>
        <p className="mt-[8px] text-[15px] leading-snug text-gray-100">
          This one sounds like it needs Sarah. Mark it as Pending so she Confirms it?
        </p>
        <div className="mt-[14px] flex gap-[10px]">
          <button
            type="button"
            onClick={() => answer(onMark)}
            className="flex-1 rounded-[12px] bg-brand-accent px-[16px] py-[11px] text-[15px] font-bold text-brand-primary transition-transform active:scale-[0.96]"
          >
            Mark it
          </button>
          <button
            type="button"
            onClick={() => answer(onDismiss)}
            className="flex-1 rounded-[12px] bg-white px-[16px] py-[11px] text-[15px] font-bold text-gray-100 transition-transform active:scale-[0.96]"
          >
            No need
          </button>
        </div>
      </div>
      <p
        className={clsx(
          'mt-[6px] text-right text-[12px] text-gray-60',
          leaving && 'animate-card-out',
        )}
      >
        Only you can see this
      </p>
    </div>
  );
}
