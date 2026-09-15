import type { ReactNode } from 'react';
import clsx from 'clsx';

/**
 * IconBox — rounded button that holds a single icon.
 *
 * - `shape="rounded"` (default) → rounded-lg square (Logs / AI screens)
 * - `shape="pill"` → fully round circle (Chat / conversation screens)
 */
export function IconBox({
  children,
  size = 48,
  shape = 'rounded',
  onClick,
  className,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  size?: 42 | 48;
  shape?: 'rounded' | 'pill';
  onClick?: () => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={clsx(
        // The lift belongs to the control, not the screen: these sit in
        // headers that content scrolls underneath, and one shadowed while the
        // next isn't is the kind of inconsistency you feel before you see it.
        'flex items-center justify-center bg-brand-tint-1 shadow-lift transition-colors active:bg-brand-border',
        size === 48 ? 'size-12' : 'size-[42px]',
        shape === 'pill' ? 'rounded-full' : 'rounded-lg',
        className,
      )}
    >
      {children}
    </button>
  );
}
