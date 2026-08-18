import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger';
export type ButtonSize = 'md' | 'sm';

const VARIANT: Record<ButtonVariant, string> = {
  // Save / confirm — brand purple, white label.
  primary: 'bg-brand-primary text-white active:scale-95',
  // Cancel / View Notes — tinted, dark label. Presses by darkening, not scaling.
  secondary: 'bg-brand-tint-1 text-gray-100 active:bg-brand-border',
  // Press to Speak — lime, brand-active label.
  accent: 'bg-brand-accent text-brand-active active:scale-95',
  // Stop recording — alert red, white label.
  danger: 'bg-alert text-white active:scale-95',
};

const SIZE: Record<ButtonSize, string> = {
  md: 'h-12 px-6',
  sm: 'h-btn-sm px-4',
};

/**
 * Button — the labeled action button.
 *
 * Every labeled button in Alio is one of four variants at one of two heights.
 * Icon-only buttons are `IconBox` (tinted square/pill) or `FloatingAddButton`
 * (the lime FAB) — not this.
 *
 * Pass `className` for layout only (`flex-1`, a fixed width); the variant owns
 * color, radius and press feedback.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-lg text-base font-bold transition',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
