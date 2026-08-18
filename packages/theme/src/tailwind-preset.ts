import type { Config } from 'tailwindcss';
import { colors, fontFamily, fontSize, borderRadius, voiceGradient } from './tokens';

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
      },
      fontFamily: {
        sans: [...fontFamily.sans],
      },
      fontSize: fontSize as never,
      borderRadius: borderRadius as never,
      height: {
        // Button sizes — 48px is Tailwind's h-12; 42px is off-scale.
        'btn-sm': '42px',
      },
      backgroundImage: {
        // "Hi, I am listening" — idle is a static left-to-right ramp; listening
        // repeats the dark end so a sliding background-position loops seamlessly.
        'voice-idle': `linear-gradient(to right, ${voiceGradient.indigo} 10%, ${voiceGradient.primary} 55%, ${voiceGradient.pink} 100%)`,
        'voice-listening': `linear-gradient(90deg, ${voiceGradient.indigo} 0%, ${voiceGradient.primary} 22%, ${voiceGradient.lavender} 45%, ${voiceGradient.pink} 60%, ${voiceGradient.orchid} 78%, ${voiceGradient.indigo} 100%)`,
      },
      backgroundSize: {
        // Wider than the element so shifting position reveals new colors.
        flow: '300% 100%',
      },
      animation: {
        // Keyframes live in globals.css (listening-gradient, blob-pulse).
        'voice-flow': 'listening-gradient 3.6s ease-in-out infinite',
        'blob-pulse': 'blob-pulse 2.6s ease-in-out infinite',
      },
    },
  },
};

export default tailwindPreset;
