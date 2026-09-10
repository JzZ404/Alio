'use client';

import { useRef } from 'react';
import clsx from 'clsx';
import { IconClose, IconMicrophone, IconArrowUp } from './icons';

/** Below this, a press counts as a tap (open the keyboard); above it, the press
 * is a hold and starts recording. */
const HOLD_MS = 200;

export type DockMode = 'idle' | 'recording' | 'typing';

/**
 * VoiceDock — the controls for talking to Alio.
 *
 * Sits directly on its container's surface: no pill, no card of its own. The
 * caption reads above the row and the row itself is close / press-target / mic,
 * so the whole bottom area is one continuous thing to speak into.
 */
export function VoiceDock({
  mode,
  value,
  onChange,
  caption,
  onHoldStart,
  onHoldEnd,
  onTap,
  onSend,
  onClose,
  placeholder = 'Hold to talk, tap to type',
  disabled,
  className,
}: {
  mode: DockMode;
  value: string;
  onChange: (v: string) => void;
  /** Live transcript or prompt shown above the controls. */
  caption?: string;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onTap: () => void;
  onSend: () => void;
  /** Left button — cancels typing or puts the sheet away. Omit when there is
   * nothing to dismiss; the slot then holds its width so nothing shifts. */
  onClose?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    if (disabled) return;
    heldRef.current = false;
    timerRef.current = setTimeout(() => {
      heldRef.current = true;
      onHoldStart();
    }, HOLD_MS);
  };

  const handlePointerUp = () => {
    if (disabled) return;
    clearTimer();
    if (heldRef.current) {
      heldRef.current = false;
      onHoldEnd();
    } else {
      onTap();
    }
  };

  // Dragging off the press target mid-hold still ends the recording — losing
  // the pointer should not leave the mic running.
  const handlePointerLeave = () => {
    clearTimer();
    if (!heldRef.current) return;
    heldRef.current = false;
    onHoldEnd();
  };

  const recording = mode === 'recording';
  const typing = mode === 'typing';

  return (
    <div className={clsx('flex flex-col gap-[14px]', className)}>
      {/* Caption — what Alio heard, or what it is waiting for. */}
      {(caption || recording) && (
        <p
          className={clsx(
            'px-[6px] text-md leading-[22px]',
            recording ? 'text-gray-100' : 'text-gray-60',
          )}
        >
          {caption || 'Listening…'}
        </p>
      )}

      <div className="flex items-center gap-[12px]">
        {onClose ? (
          <button
            type="button"
            aria-label={typing ? 'Cancel typing' : 'Close'}
            onClick={onClose}
            className="flex size-[44px] shrink-0 items-center justify-center rounded-full border border-brand-border transition-transform active:scale-95"
          >
            <IconClose className="size-[18px] text-gray-80" />
          </button>
        ) : (
          <span className="size-[44px] shrink-0" aria-hidden />
        )}

        {typing ? (
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSend();
            }}
            placeholder="Type a note…"
            className="h-[44px] min-w-0 flex-1 bg-transparent text-md text-gray-100 placeholder:text-gray-60 outline-none"
          />
        ) : (
          /* The press target: hold to record, tap to type. */
          <button
            type="button"
            aria-label={recording ? 'Release to save note' : placeholder}
            disabled={disabled}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerCancel={handlePointerLeave}
            onContextMenu={(e) => e.preventDefault()}
            className="flex h-[44px] min-w-0 flex-1 select-none items-center justify-center disabled:opacity-50"
          >
            {recording ? (
              <DotMatrix active />
            ) : (
              <span className="truncate text-md text-gray-60">{placeholder}</span>
            )}
          </button>
        )}

        {typing ? (
          <button
            type="button"
            aria-label="Send"
            onClick={onSend}
            disabled={!value.trim() || disabled}
            className="flex size-[44px] shrink-0 items-center justify-center rounded-full bg-brand-primary transition-transform active:scale-95 disabled:opacity-40"
          >
            <IconArrowUp className="size-[20px] text-gray-10" />
          </button>
        ) : (
          <span
            className={clsx(
              'flex size-[44px] shrink-0 items-center justify-center rounded-full border transition-colors',
              recording ? 'border-transparent bg-brand-accent' : 'border-brand-border',
            )}
          >
            <IconMicrophone
              className={clsx('size-[20px]', recording ? 'text-brand-active' : 'text-gray-80')}
            />
          </span>
        )}
      </div>
    </div>
  );
}

/** Two rows of dots that ripple while recording — decorative, not real audio. */
function DotMatrix({ active }: { active?: boolean }) {
  const cols = Array.from({ length: 22 }, (_, i) => i);
  return (
    <span className="flex items-center gap-[4px]" aria-hidden>
      {cols.map((i) => (
        <span key={i} className="flex flex-col gap-[4px]">
          <Dot i={i} active={active} />
          <Dot i={i + 3} active={active} />
        </span>
      ))}
      <style>{`
        @keyframes alio-dot {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 1; }
        }
      `}</style>
    </span>
  );
}

function Dot({ i, active }: { i: number; active?: boolean }) {
  return (
    <span
      className="size-[4px] rounded-full bg-brand-primary"
      style={
        active
          ? { animation: `alio-dot 1400ms ease-in-out ${(i % 8) * 110}ms infinite` }
          : { opacity: 0.25 }
      }
    />
  );
}
