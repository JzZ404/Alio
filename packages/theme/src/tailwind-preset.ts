import type { Config } from 'tailwindcss';
import { colors, fontFamily, fontSize, borderRadius } from './tokens';

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
    },
  },
};

export default tailwindPreset;
