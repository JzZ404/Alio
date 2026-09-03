'use client';

import { useRef, useState } from 'react';
import clsx from 'clsx';
import { IconPlus, IconMicrophone, IconArrowUp } from './icons';

/** Below this, a press counts as a tap (open the keyboard); above it, the press
 * is a hold and starts recording. */
const HOLD_MS = 200;

export type BarMode = 'idle' | 'recording' | 'typing';

/**
 * HoldToTalkBar — the one persistent control on the Log screen.
 *
 * Hold the pill to record, release to send. Tap it to type instead. The bar
 * itself is the mode switch, so there is no separate keyboard/mic button and
 * nothing moves when the mode changes.
 */
export function HoldToTalkBar({
  mode,
  value,
  onChange,
  onHoldStart,
  onHoldEnd,
  onTap,
  onSend,
  onExitTyping,
  onPlus,
  placeholder = 'Hold to talk, tap to type',
  disabled,
  className,
}: {
  mode: BarMode;
  value: string;
  onChange: (v: string) => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onTap: () => void;
  onSend: () => void;
  onExitTyping: () => void;
  onPlus?: () => void;
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

  // Dragging off the pill mid-hold still ends the recording — losing the
  // pointer should not leave the mic running.
  const handlePointerLeave = () => {
    if (!heldRef.current) {
      clearTimer();
      return;
    }
    clearTimer();
    heldRef.current = false;
    onHoldEnd();
  };

  if (mode === 'typing') {
    return (
      <div className={clsx('flex items-center gap-[10px]', className)}>
        <div className="flex h-[56px] flex-1 items-center gap-[10px] rounded-full bg-white px-[8px] pr-[14px] shadow-[0_2px_16px_rgba(0,0,0,0.08)]">
          <button
            type="button"
            aria-label="Back to voice"
            onClick={onExitTyping}
            className="flex size-[40px] shrink-0 items-center justify-center rounded-full bg-brand-tint-1 transition-transform active:scale-95"
          >
            <IconMicrophone className="size-[20px] text-brand-primary" />
          </button>
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSend();
            }}
            placeholder="Type a note…"
            className="flex-1 bg-transparent text-[15px] text-gray-100 placeholder:text-gray-60 outline-none"
          />
          <button
            type="button"
            aria-label="Send"
            onClick={onSend}
            disabled={!value.trim() || disabled}
            className="flex size-[32px] shrink-0 items-center justify-center rounded-full bg-brand-primary transition-transform active:scale-95 disabled:opacity-40"
          >
            <IconArrowUp className="size-[18px] text-white" />
          </button>
        </div>
      </div>
    );
  }

  const recording = mode === 'recording';

  return (
    <div className={clsx('flex items-center gap-[10px]', className)}>
      <div
        className={clsx(
          'flex h-[56px] flex-1 select-none items-center gap-[10px] rounded-full px-[8px] pr-[8px] transition-colors',
          'shadow-[0_2px_16px_rgba(0,0,0,0.08)]',
          recording ? 'bg-brand-accent' : 'bg-white',
        )}
      >
        <button
          type="button"
          aria-label="More actions"
          onClick={onPlus}
          disabled={recording}
          className="flex size-[40px] shrink-0 items-center justify-center rounded-full bg-brand-tint-1 transition-transform active:scale-95 disabled:opacity-40"
        >
          <IconPlus className="size-[20px] text-brand-primary" />
        </button>

        {/* The pill body is the press target: hold = record, tap = type. */}
        <button
          type="button"
          aria-label={recording ? 'Release to save note' : 'Hold to talk, tap to type'}
          disabled={disabled}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerLeave}
          onContextMenu={(e) => e.preventDefault()}
          className="flex h-full flex-1 items-center justify-center disabled:opacity-50"
        >
          {recording ? <Waveform /> : (
            <span className="text-[15px] text-gray-60">{placeholder}</span>
          )}
        </button>

        <span
          className={clsx(
            'flex size-[40px] shrink-0 items-center justify-center rounded-full transition-colors',
            recording ? 'bg-brand-active' : 'bg-brand-primary',
          )}
        >
          <IconMicrophone className="size-[20px] text-white" />
        </span>
      </div>
    </div>
  );
}

/** Simple animated level meter — decorative, not driven by real audio. */
function Waveform() {
  const bars = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  return (
    <span className="flex h-[24px] items-center gap-[3px]" aria-hidden>
      {bars.map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-brand-active"
          style={{
            height: `${8 + ((i * 7) % 14)}px`,
            animation: `alio-wave 900ms ease-in-out ${i * 70}ms infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes alio-wave {
          0%, 100% { transform: scaleY(0.45); }
          50%      { transform: scaleY(1); }
        }
      `}</style>
    </span>
  );
}
