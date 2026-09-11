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
  /** Layered translucency for the bottom nav — Figma 411:6936 "Bar".
   * The selected tab is a dark scrim, not a light chip: on glass, "pressed in"
   * reads as a recess. */
  /** Bottom nav. The selected slot is a dark scrim, not a light chip: on the
   * translucent bar, the active tab reads as pressed in. From Figma 411:6936. */
  glass: {
    selected: 'rgba(0, 0, 0, 0.10)',
  },
  info: {
    blue: '#1C4EAB',
  },
} as const;

/** The app's page background. One ramp across the whole phone frame, so the
 * tab bar floats on the same surface as the content above it rather than on a
 * flat band. */
export const backgroundImage = {
  app: `linear-gradient(135deg, ${'#E3E5F1'} 0%, ${'#EAEAF2'} 50%, ${'#D3D5EC'} 100%)`,
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
