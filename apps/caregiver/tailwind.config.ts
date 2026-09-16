import type { Config } from 'tailwindcss';
import { tailwindPreset } from '@alio/theme/tailwind-preset';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  presets: [tailwindPreset as Config],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
    },
  },
};

export default config;
