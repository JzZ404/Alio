import type { CSSProperties } from 'react';

/**
 * Mask for a scroller that runs under floating controls.
 *
 * A scroller that starts below a header stops its content dead at an invisible
 * line, and the strip above reads as a cut-out band. Instead the scroller runs
 * the full height, pads the header's space, and fades its content out where it
 * passes beneath — so cards dissolve under the buttons rather than being
 * sliced by them.
 *
 * @param top    Where the content is fully opaque, in px. Give the header's
 *               bottom edge plus a little; the fade starts 30px above it.
 * @param bottom Length of the bottom fade, in px. 0 for a hard bottom edge.
 */
export function scrollFade(top: number, bottom = 44): CSSProperties {
  const gradient = [
    'linear-gradient(to bottom',
    `transparent ${Math.max(0, top - 30)}px`,
    `#000 ${top}px`,
    bottom > 0 ? `#000 calc(100% - ${bottom}px)` : null,
    bottom > 0 ? 'transparent' : '#000',
  ]
    .filter(Boolean)
    .join(', ') + ')';

  return { WebkitMaskImage: gradient, maskImage: gradient };
}
