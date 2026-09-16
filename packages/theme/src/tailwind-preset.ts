import type { Config } from 'tailwindcss';
import { attention, colors, fontFamily, fontSize, borderRadius } from './tokens';

export const tailwindPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: colors.brand.primary,
          primary: colors.brand.primary,
          active: colors.brand.active,
          accent: colors.brand.accent,
          'tint-1': colors.brand.tint1,
          'tint-2': colors.brand.tint2,
          border: colors.brand.border,
        },
        gray: {
          10: colors.gray[10],
          30: colors.gray[30],
          60: colors.gray[60],
          80: colors.gray[80],
          90: colors.gray[90],
          100: colors.gray[100],
        },
        alert: colors.alert.red,
        info: colors.info.blue,
        attention: {
          surface: attention.surface,
          border: attention.border,
          text: attention.text,
        },
      },
      fontFamily: {
        // Spread: tokens.ts declares fontFamily `as const`, and Tailwind's
        // FontFamily type wants a mutable string[].
        sans: [...fontFamily.sans],
      },
      keyframes: {
        // Tab content entering after a segmented-control switch.
        'tab-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Screen pushed on: arrives from the right, the way it was opened.
        'screen-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        // Screen returned to: arrives from the left, undoing the push.
        'screen-in-left': {
          from: { opacity: '0', transform: 'translateX(-24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        // Tab switch: no direction to imply, so it simply lifts into place.
        'screen-fade': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'tab-in': 'tab-in 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        'screen-in-right': 'screen-in-right 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        'screen-in-left': 'screen-in-left 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        'screen-fade': 'screen-fade 220ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
      fontSize: fontSize as never,
      borderRadius: borderRadius as never,
    },
  },
};

export default tailwindPreset;
