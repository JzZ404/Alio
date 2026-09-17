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
        // Long-press menu: rises from the message it belongs to.
        'sheet-in': {
          from: { opacity: '0', transform: 'translateY(-6px) scale(0.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // The blur behind it fades rather than snapping on.
        'backdrop-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        // Closing the long-press menu: it leaves the way it arrived, back
        // towards the message it belongs to.
        'sheet-out': {
          from: { opacity: '1', transform: 'translateY(0) scale(1)' },
          to: { opacity: '0', transform: 'translateY(-6px) scale(0.96)' },
        },
        'backdrop-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        // The held message lifts off the thread rather than simply being
        // covered by a blur — the gesture should feel like picking it up.
        'message-lift': {
          from: { transform: 'scale(1)' },
          to: { transform: 'scale(1.03)' },
        },
        'message-drop': {
          from: { transform: 'scale(1.03)' },
          to: { transform: 'scale(1)' },
        },
        // A message arriving in the thread, and the ALIO SUGGESTS card
        // appearing under one.
        'message-in': {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'card-in': {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // Answering the card — "Mark it" or "No need" — takes it away rather
        // than blinking it out of existence.
        'card-out': {
          from: { opacity: '1', transform: 'translateY(0) scale(1)' },
          to: { opacity: '0', transform: 'translateY(-4px) scale(0.97)' },
        },
        // The status line under a bubble when the state changes under it:
        // Sent becoming Pending, Pending becoming Confirmed.
        'status-in': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'tab-in': 'tab-in 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        'screen-in-right': 'screen-in-right 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        'screen-in-left': 'screen-in-left 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        'screen-fade': 'screen-fade 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        'sheet-in': 'sheet-in 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        'backdrop-in': 'backdrop-in 160ms ease-out',
        // `forwards` on every exit: the element has to hold its final frame
        // until the state change unmounts it, or it snaps back first.
        'sheet-out': 'sheet-out 160ms cubic-bezier(0.4, 0, 1, 1) forwards',
        'backdrop-out': 'backdrop-out 160ms ease-in forwards',
        'message-lift': 'message-lift 200ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'message-drop': 'message-drop 160ms cubic-bezier(0.4, 0, 1, 1) forwards',
        'message-in': 'message-in 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        'card-in': 'card-in 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        'card-out': 'card-out 200ms cubic-bezier(0.4, 0, 1, 1) forwards',
        'status-in': 'status-in 240ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
      fontSize: fontSize as never,
      borderRadius: borderRadius as never,
    },
  },
};

export default tailwindPreset;
