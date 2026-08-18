import type { Config } from 'tailwindcss';
import { tailwindPreset } from '../packages/theme/src/tailwind-preset';

/**
 * Tailwind config used ONLY to compile the design-system stylesheet that ships
 * to claude.ai/design (`packages/ui/.ds-css/ds.css`).
 *
 * The apps compile Tailwind themselves; the DS package ships no CSS of its own,
 * so this config reproduces the apps' setup (same preset, same screens) with
 * content scanned across the component source, the authored preview files, and
 * both apps — the apps are what prove which utilities the design language
 * actually uses.
 */
const config: Config = {
  safelist: [
    // Voice/motion vocabulary documented in conventions.md — the preset defines
    // these but source only uses some, so safelist them or the agent's classes
    // silently resolve to nothing.
    'bg-voice-idle',
    'bg-voice-listening',
    'bg-flow',
    'animate-voice-flow',
    'animate-blob-pulse',
    { pattern: /^(bg|text|border|fill|stroke|ring|divide|outline)-(brand|gray|alert|info|white|black|transparent)(-(DEFAULT|primary|active|accent|tint-1|tint-2|border|10|30|60|80|90|100))?$/ },
    { pattern: /^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|inset|top|right|bottom|left)-(0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|auto|px)$/ },
    { pattern: /^(w|h|min-w|min-h|max-w|max-h|size)-(0|1|2|3|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|40|48|56|64|72|80|96|full|screen|auto|fit|min|max|px|1\/2|1\/3|2\/3|1\/4|3\/4)$/ },
    { pattern: /^rounded(-(t|r|b|l|tl|tr|br|bl))?(-(none|sm|md|lg|xl|2xl|3xl|full))?$/ },
    { pattern: /^text-(xs|sm|base|md|lg|xl|2xl|left|center|right|justify)$/ },
    { pattern: /^font-(thin|light|normal|medium|semibold|bold|extrabold|sans)$/ },
    { pattern: /^(leading|tracking)-(none|tight|snug|normal|relaxed|loose|wide|wider|widest|3|4|5|6|7|8|9|10)$/ },
    { pattern: /^(flex|grid|inline-flex|inline-grid|block|inline-block|inline|hidden|contents|table)$/ },
    { pattern: /^(flex|justify|items|content|self|place)-(row|row-reverse|col|col-reverse|wrap|nowrap|1|auto|initial|none|start|end|center|between|around|evenly|stretch|baseline)$/ },
    { pattern: /^(grid-cols|grid-rows|col-span|row-span|order)-(1|2|3|4|5|6|7|8|9|10|11|12|none|full)$/ },
    { pattern: /^(absolute|relative|fixed|sticky|static)$/ },
    { pattern: /^(overflow|overflow-x|overflow-y)-(auto|hidden|visible|scroll|clip)$/ },
    { pattern: /^(shadow|drop-shadow)(-(sm|md|lg|xl|2xl|inner|none))?$/ },
    { pattern: /^(opacity|z)-(0|5|10|20|25|30|40|50|60|70|75|80|90|95|100)$/ },
    { pattern: /^(border|border-t|border-r|border-b|border-l)(-(0|2|4|8))?$/ },
    { pattern: /^(truncate|uppercase|lowercase|capitalize|italic|underline|line-through|antialiased|cursor-pointer|select-none|pointer-events-none|transition|duration-(75|100|150|200|300|500|700|1000)|ease-(in|out|in-out|linear))$/ },
    { pattern: /^(backdrop-blur|blur)(-(none|sm|md|lg|xl|2xl|3xl))?$/ },
    { pattern: /^(object|bg)-(cover|contain|fill|center|top|bottom|left|right|no-repeat)$/ },
  ],
  content: [
    './packages/ui/src/**/*.{ts,tsx}',
    './.design-sync/previews/**/*.{ts,tsx}',
    './apps/*/app/**/*.{ts,tsx}',
    './apps/*/components/**/*.{ts,tsx}',
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
