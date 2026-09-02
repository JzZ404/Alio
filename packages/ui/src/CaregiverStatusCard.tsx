'use client';

import { useState } from 'react';
import clsx from 'clsx';
import {
  IconChevronDown,
  IconHandphone,
  IconChat,
  IconLocationPinFilled,
} from './icons';
import type { CaregiverStatus, Caregiver } from '@alio/mock-data';

/** Width of one step column. The circle is centred inside it, so half of this
 * is also the distance from the row edge to the first/last circle centre. */
const STEP_W = 60;

const STEPS: { key: CaregiverStatus; label: string }[] = [
  { key: 'on-the-way', label: 'On way' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'complete', label: 'Complete' },
];

/**
 * CaregiverStatusCard — top white card on Family Home.
 *
 * - `folded` (default) — compact: avatar + headline + name + chevron-down
 * - `expanded` — full card: stepper + map preview + caregiver detail row with contact buttons
 *
 * Visuals match Figma node 254:2787 (expanded state) — stepper is a single
 * horizontal track with a progress fill, NOT 3 separate connector segments.
 */
export function CaregiverStatusCard({
  caregiver,
  status = 'on-the-way',
  defaultExpanded,
  avatarUrl,
  mapImageUrl,
}: {
  caregiver: Caregiver;
  status?: CaregiverStatus;
  defaultExpanded?: boolean;
  avatarUrl?: string;
  /** Optional path to a real map screenshot served from the app's /public folder.
   * When omitted, a gradient placeholder is shown instead. */
  mapImageUrl?: string;
}) {
  const initial = defaultExpanded ?? status === 'arrived';
  const [expanded, setExpanded] = useState(initial);

  const headline =
    status === 'on-the-way'
      ? 'Caregiver on the way'
      : status === 'arrived'
        ? 'Caregiver arrived at house'
        : status === 'in-progress'
          ? 'Visit in progress'
          : 'Visit complete';

  const activeIdx = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="rounded-3xl bg-white p-5">
      {/* Header — always present */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xl font-bold text-gray-100 leading-tight">{headline}</p>
          <p className="text-sm text-gray-60">{caregiver.name}</p>
        </div>

        {!expanded && <Avatar src={avatarUrl} name={caregiver.name} size={48} />}

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? 'Collapse caregiver status' : 'Expand caregiver status'}
          className="flex size-8 shrink-0 items-center justify-center rounded-md transition-colors active:bg-brand-tint-1"
        >
          <IconChevronDown
            className={clsx('size-5 text-gray-100 transition-transform', expanded && 'rotate-180')}
          />
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <>
          <ProgressStepper activeIdx={activeIdx} className="mt-5" />
          <MapPreview status={status} imageUrl={mapImageUrl} className="mt-4" />

          {/* Caregiver row */}
          <div className="mt-4 flex items-center gap-[15px]">
            <Avatar src={avatarUrl} name={caregiver.name} size={57} />
            <div className="flex flex-1 flex-col gap-[7px]">
              <span className="text-base font-bold text-gray-100 leading-none">
                {caregiver.name}
              </span>
              <span className="text-sm text-gray-100 leading-none">
                {caregiver.visits} Visits
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={`Call ${caregiver.name}`}
                className="flex size-[38px] items-center justify-center rounded-[12px] bg-brand-border p-2 transition-colors active:bg-brand-tint-1"
              >
                <IconHandphone className="size-5 text-brand-primary" />
              </button>
              <button
                type="button"
                aria-label={`Message ${caregiver.name}`}
                className="flex size-[38px] items-center justify-center rounded-[12px] bg-brand-border p-2 transition-colors active:bg-brand-tint-1"
              >
                <IconChat className="size-5 text-brand-primary" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Progress stepper — one continuous track + 4 circle indicators
// ============================================================

function ProgressStepper({ activeIdx, className }: { activeIdx: number; className?: string }) {
  // Geometry constants matching Figma 254:2787 stepper.
  const TRACK_BG = '#D9D9D9';
  const TRACK_FILL = '#5E69F6';

  // Fill width as % across the 4-step row. Each step is at 0%, 33%, 66%, 100% center.
  // Active step's fill reaches the active circle center.
  const fillPct = activeIdx <= 0 ? 0 : (activeIdx / (STEPS.length - 1)) * 100;

  // Track spans centre-to-centre of the first and last circles, so it never
  // pokes out past them. Each <li> is STEP_W wide with the circle centred, so
  // the first centre sits at STEP_W / 2 from the left (and likewise the right).
  const INSET = STEP_W / 2;

  return (
    <div className={clsx('relative', className)}>
      {/* Track + fill (vertically centred on the circles: 28/2 - 3/2 = 12.5px) */}
      <div
        className="absolute top-[12.5px] h-[3px] rounded-full"
        style={{ left: INSET, right: INSET, background: TRACK_BG }}
        aria-hidden
      />
      <div
        className="absolute top-[12.5px] h-[3px] rounded-full transition-[width] duration-300 ease-out"
        style={{
          left: INSET,
          width: `calc((100% - ${STEP_W}px) * ${fillPct / 100})`,
          background: TRACK_FILL,
        }}
        aria-hidden
      />

      <ol className="relative flex items-start justify-between">
        {STEPS.map((step, i) => {
          const state: 'done' | 'active' | 'future' =
            i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'future';
          return (
            <li
              key={step.key}
              className="flex flex-col items-center gap-1"
              style={{ width: STEP_W }}
            >
              <StepCircle state={state} index={i} />
              <span
                className="text-[10.4px] capitalize"
                style={{ color: '#3C3C3C' }}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepCircle({ state, index }: { state: 'done' | 'active' | 'future'; index: number }) {
  if (state === 'done') {
    return (
      <span
        className="flex size-7 items-center justify-center rounded-full"
        style={{ background: '#5E69F6' }}
      >
        <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none">
          <path
            d="M5 12.5l4 4 10-10"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span
        className="flex size-7 items-center justify-center rounded-full"
        style={{ background: '#5E69F6' }}
      >
        <span className="text-xs font-bold text-white">{index + 1}</span>
      </span>
    );
  }
  return (
    <span
      className="flex size-7 items-center justify-center rounded-full border-[1.7px]"
      style={{ background: '#D9D9D9', borderColor: '#7B7B7B' }}
    >
      <span className="text-xs font-bold" style={{ color: '#7B7B7B' }}>
        {index + 1}
      </span>
    </span>
  );
}

// ============================================================
// Avatar — image OR gradient fallback
// ============================================================

function Avatar({
  src,
  name,
  size = 48,
}: {
  src?: string;
  name: string;
  size?: 48 | 57;
}) {
  return (
    <span
      className="shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="size-full object-cover"
          width={size}
          height={size}
        />
      ) : (
        <FallbackAvatar />
      )}
    </span>
  );
}

function FallbackAvatar() {
  return (
    <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
      <defs>
        <linearGradient id="avatarGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5E69F6" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" fill="url(#avatarGrad)" />
      <circle cx="24" cy="18" r="7" fill="white" opacity="0.95" />
      <path d="M8 44c0-8.84 7.16-16 16-16s16 7.16 16 16" fill="white" opacity="0.95" />
    </svg>
  );
}

// ============================================================
// Map preview placeholder
// ============================================================

function MapPreview({
  status,
  imageUrl,
  className,
}: {
  status: CaregiverStatus;
  imageUrl?: string;
  className?: string;
}) {
  return (
    <div
      className={clsx('relative h-[160px] overflow-hidden rounded-2xl', className)}
      style={
        imageUrl
          ? {
              backgroundImage: `url('${imageUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : {
              background:
                'radial-gradient(ellipse at 30% 40%, #DDE7F2 0%, #C9DBE9 30%, #B5CADD 60%, #A2B8CC 100%)',
            }
      }
      aria-label="Caregiver location preview"
    >
      {/* Simulated street overlay only when no real map */}
      {!imageUrl && (
        <div className="absolute inset-0 opacity-30" aria-hidden>
          <div className="absolute left-[10%] top-[40%] h-[2px] w-[80%] -rotate-12 bg-white" />
          <div className="absolute left-[20%] top-[70%] h-[2px] w-[70%] rotate-6 bg-white" />
          <div className="absolute left-[40%] top-0 h-full w-[2px] rotate-12 bg-white" />
        </div>
      )}

      {/* Translucent radius indicator behind the pin */}
      <div className="absolute left-1/2 top-1/2 size-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary/25" />

      {/* Pin + status label */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
        <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-gray-100 shadow">
          {status === 'arrived' ? 'Arrived' : 'En route'}
        </span>
        <IconLocationPinFilled className="size-6 text-gray-100" />
      </div>
    </div>
  );
}
