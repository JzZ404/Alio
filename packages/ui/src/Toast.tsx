/**
 * A brief confirmation that something happened — "Text Copied." after the
 * long-press menu's Copy text (design 2026-09-17).
 *
 * Deliberately presentational: it renders while it is mounted and knows
 * nothing about time. The screen owns the timer, so the same component can
 * sit behind a state that clears itself and one that does not, and a test can
 * assert on it without faking clocks.
 *
 * `role="status"` rather than `role="alert"`: this is a courtesy, not an
 * interruption, and a screen reader should finish the sentence it is on
 * before announcing it.
 */
export function Toast({ message }: { message: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[120px] z-40 flex justify-center">
      <p
        role="status"
        className="animate-sheet-in rounded-full bg-gray-100/90 px-[18px] py-[10px] text-[13px] font-bold text-white"
      >
        {message}
      </p>
    </div>
  );
}
