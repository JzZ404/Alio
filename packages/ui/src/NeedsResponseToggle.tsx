import clsx from 'clsx';
import { IconAttention } from './icons';

/**
 * Composer toggle: the sender marks the next message "Needs response".
 *
 * preventDefault on mousedown keeps focus in the text field, so tapping the
 * toggle does not blur the input mid-composition. Spec §10 still requires a
 * check on a real device with a non-Latin input method.
 */
export function NeedsResponseToggle({
  pressed,
  onToggle,
}: {
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Needs response"
      aria-pressed={pressed}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      className={clsx(
        'flex size-[44px] shrink-0 items-center justify-center rounded-full transition-colors',
        pressed
          ? 'bg-attention-surface text-attention-text ring-1 ring-attention-border'
          : 'bg-white/70 text-gray-100 active:bg-white',
      )}
    >
      <IconAttention aria-hidden className="size-[22px]" />
    </button>
  );
}
