/**
 * Alio design tokens
 * Extracted from Figma file "Alio" (9oY1M8Eqn6c8KTJA0limuE), page "Claude MCP".
 */

export const colors = {
  brand: {
    primary: '#5E69F6',
    active: '#4856FF',
    accent: '#C0DA5A',
    tint1: '#EDEDFC',
    tint2: '#EAEAF2',
    border: '#D3D5EC',
  },
  gray: {
    10: '#FFFFFF',
    30: '#EDEDED',
    60: '#9E9E9E',
    80: '#28292C',
    90: '#181818',
    100: '#0A0A0A',
  },
  alert: {
    red: '#FF3B30',
  },
  info: {
    blue: '#1C4EAB',
  },
} as const;

/**
 * Voice gradient — the purple → pink ramp behind "Hi, I am listening" on the
 * caregiver Logs and family AI Check voice screens. Dark indigo at both ends so
 * the animated version can slide the background position and loop seamlessly.
 */
export const voiceGradient = {
  indigo: '#2B1B72',
  primary: '#5E69F6',
  lavender: '#A29BFE',
  pink: '#F4B6C8',
  orchid: '#D496F5',
} as const;

export const fontFamily = {
  sans: ['var(--font-century-gothic)', 'system-ui', 'sans-serif'],
} as const;

export const fontSize = {
  xs: ['10px', { lineHeight: '14px' }],
  sm: ['12px', { lineHeight: '16px' }],
  base: ['14px', { lineHeight: '20px' }],
  md: ['16px', { lineHeight: '22px' }],
  lg: ['18px', { lineHeight: '24px' }],
  xl: ['20px', { lineHeight: '28px' }],
  '2xl': ['24px', { lineHeight: '30px' }],
} as const;

export const borderRadius = {
  none: '0',
  sm: '3px',
  DEFAULT: '8px',
  md: '8px',
  lg: '12px',
  xl: '14px',
  '2xl': '24px',
  full: '9999px',
} as const;

export const spacing = {
  // Tailwind defaults align well with Figma scale (4/8/12/16/20/24/32/40/48)
  // No overrides needed; preset will use Tailwind's defaults
} as const;

export const tokens = {
  colors,
  fontFamily,
  fontSize,
  borderRadius,
  spacing,
} as const;

export type Tokens = typeof tokens;
