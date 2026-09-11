'use client';

import type { ComponentType, SVGProps } from 'react';
import clsx from 'clsx';

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
 * One translucent white pane over a wide blur. Figma layers this (plate, grey
 * tint, overlay ellipse, three blurred rims), but those layers do not compose
 * the same way in CSS and the reproduction read heavier than the design, so the
 * simpler pane stands.
 *
 * The selected tab is a dark scrim rather than a light chip — from the design,
 * where the active slot reads as pressed into the surface.
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
        'relative flex items-stretch rounded-full',
        'border border-gray-10/80 bg-gray-10/40 shadow-[0_2px_22px_rgba(0,0,0,0.15)] backdrop-blur-2xl',
        className,
      )}
    >
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
