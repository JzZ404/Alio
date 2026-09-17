import { IconRiVoiceAiFill } from './icons';

/**
 * The ALIO SUGGESTS card (spec §4, family design 2026-09-16). Rendered under
 * one of the family member's own untagged messages when the stubbed
 * `suggestsPending` heuristic thinks it needs Sarah. Real, but the suggestion
 * behind it is a stand-in until the classifier plan runs — see
 * `messaging/suggest.ts`.
 *
 * `onMark` and `onDismiss` both just report the answer; the caller owns what
 * happens next (marking Pending, or nothing at all).
 */
export function SuggestionCard({
  onMark,
  onDismiss,
}: {
  onMark: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex flex-col self-end">
      <div className="mt-[8px] w-full max-w-[75%] self-end rounded-[16px] bg-white/70 px-[16px] py-[14px]">
        <p className="flex items-center gap-[6px] text-[12px] font-bold uppercase tracking-[0.08em] text-gray-60">
          <IconRiVoiceAiFill aria-hidden className="size-[14px]" />
          ALIO SUGGESTS
        </p>
        <p className="mt-[8px] text-[15px] leading-snug text-gray-100">
          This one sounds like it needs Sarah. Mark it as Pending so she Confirms it?
        </p>
        <div className="mt-[12px] flex gap-[10px]">
          <button
            type="button"
            onClick={onMark}
            className="flex-1 rounded-[12px] bg-brand-accent px-[16px] py-[10px] text-[15px] font-bold text-gray-100"
          >
            Mark it
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 rounded-[12px] bg-gray-30 px-[16px] py-[10px] text-[15px] font-bold text-gray-100"
          >
            No need
          </button>
        </div>
      </div>
      <p className="mt-[6px] text-right text-[12px] text-gray-60">Only you can see this</p>
    </div>
  );
}
