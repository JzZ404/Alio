'use client';

import type { ComponentType, SVGProps } from 'react';
import clsx from 'clsx';
import { colors } from '@alio/theme';

/** The lit rim, built from tokens rather than literals. Figma blurs three
 * bordered layers for this; a CSS `filter: blur` on a bordered box bleeds
 * inward and greys the whole bar, so inset shadows carry it instead. */
const RIM = [
  `inset 0 1px 0 0 ${colors.glass.edgeBright}`,
  `inset 0 -1px 0 0 ${colors.glass.edgeSoft}`,
  `inset 0 0 0 1px ${colors.glass.edgeDark}`,
].join(', ');

/** Geometry from Figma 411:6936 "Bar". */
const NAV_W = 365;
const NAV_H = 69;
const PAD = 5;
const SLOT_W = (NAV_W - PAD * 2) / 4;

export type GlassNavTab = {
  id: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * GlassNav — the bottom tab bar.
 *
 * The glass is a stack, not one translucent fill: a white plate, a blurred and
 * slightly grey-tinted pane over it, a wide overlay ellipse that shades the
 * middle, and three hairline rims that catch and absorb light at the edge.
 * Flattening that into a single `bg-white/40` is what makes glass read as
 * milky plastic.
 *
 * The selected tab is a dark scrim rather than a light chip — on glass, the
 * active slot reads as pressed into the surface.
 */
export function GlassNav({
  tabs,
  activeIdx,
  onSelect,
  className,
}: {
  tabs: GlassNavTab[];
  activeIdx: number;
  onSelect: (id: string) => void;
  /** Cosmetic only. This component is `relative` so its glass layers anchor to
   * it — position it from a wrapper, not through this prop. */
  className?: string;
}) {
  const isFirst = activeIdx === 0;
  const isLast = activeIdx === tabs.length - 1;
  const pillLeft = isFirst ? 0 : PAD + activeIdx * SLOT_W;
  const pillWidth = isFirst || isLast ? SLOT_W + PAD : SLOT_W;

  return (
    <nav
      style={{ width: NAV_W, height: NAV_H, padding: PAD }}
      className={clsx(
        'relative flex items-stretch overflow-hidden rounded-full',
        className,
      )}
    >
      {/* 1 — the pane: one calibrated fill over a wide blur. Content scrolling
        * underneath still shows through at 45%. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-glass-plate shadow-[0_2px_22px_rgba(0,0,0,0.15)] backdrop-blur-[37px]"
      />

      {/* 3 — a very wide, very flat ellipse in overlay: shades the middle band
        * and leaves the top and bottom edges brighter. Masked to the inner
        * rounded rect, as in Figma, so it never reaches the outer edge. */}
      <span
        aria-hidden
        className="pointer-events-none absolute overflow-hidden rounded-full"
        style={{ inset: PAD }}
      >
        <span
          className="absolute bg-glass-shade mix-blend-overlay"
          style={{ width: 876, height: 113, left: -79, top: -22, borderRadius: '50%' }}
        />
      </span>

      {/* 4 — the rim. Figma stacks three blurred borders; CSS `filter: blur`
        * on a bordered box bleeds the blur inward and greys the whole bar, so
        * these are inset shadows instead: they stay at the edge. Sampled from
        * the design, the bar body should sit lighter than the page behind it,
        * not darker. */}
      <span
        aria-hidden
        style={{ boxShadow: RIM }}
        className="pointer-events-none absolute inset-0 rounded-full"
      />

      {/* Selected slot. */}
      {activeIdx >= 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute rounded-full bg-glass-selected transition-[left,width] duration-200 ease-out"
          style={{ top: PAD, bottom: PAD, left: pillLeft, width: pillWidth }}
        />
      )}

      {tabs.map((tab, idx) => {
        const active = idx === activeIdx;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(tab.id)}
            className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1"
          >
            <tab.Icon
              className={clsx('size-6', active ? 'text-brand-active' : 'text-gray-80')}
            />
            <span
              className={clsx(
                'text-[11.5px] font-bold leading-none',
                active ? 'text-brand-active' : 'text-gray-80',
              )}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
