'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { IconPlus, IconMicrophone, IconArrowUp, IconChevronLeft } from './icons';

/** Below this, a press counts as a tap (open the keyboard); above it, the press
 * is a hold and starts recording. */
const HOLD_MS = 200;

/** Drag this far left during a hold to throw the note away instead of sending. */
const CANCEL_PX = 90;

export type DockMode = 'idle' | 'recording' | 'typing';

/**
 * VoiceDock — the bar you talk into.
 *
 * One slim pill: attachments on the left, the press target across the middle,
 * mic on the right. Hold the pill to record and release to send; a quick tap
 * opens the keyboard instead. Dragging left mid-hold cancels.
 */
export function VoiceDock({
  mode,
  value,
  onChange,
  caption,
  onHoldStart,
  onHoldEnd,
  onCancel,
  onTap,
  onSend,
  onPlus,
  placeholder = 'Hold to talk, tap to type',
  disabled,
  className,
}: {
  mode: DockMode;
  value: string;
  onChange: (v: string) => void;
  /** Live transcript, or what Alio wants to say back. Sits above the pill. */
  caption?: string;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  /** Dragged left far enough — throw the recording away. */
  onCancel: () => void;
  onTap: () => void;
  onSend: () => void;
  onPlus?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);
  const startXRef = useRef(0);
  const [cancelArmed, setCancelArmed] = useState(false);

  const recording = mode === 'recording';
  const typing = mode === 'typing';
  const elapsed = useElapsed(recording);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    heldRef.current = false;
    startXRef.current = e.clientX;
    setCancelArmed(false);
    timerRef.current = setTimeout(() => {
      heldRef.current = true;
      onHoldStart();
    }, HOLD_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!heldRef.current) return;
    setCancelArmed(e.clientX - startXRef.current < -CANCEL_PX);
  };

  const finishPress = (fired: boolean) => {
    clearTimer();
    if (!heldRef.current) {
      if (fired) onTap();
      return;
    }
    heldRef.current = false;
    if (cancelArmed) onCancel();
    else onHoldEnd();
    setCancelArmed(false);
  };

  return (
    <div className={clsx('flex flex-col gap-[10px]', className)}>
      {caption && (
        <p className="px-[14px] text-md leading-[22px] text-gray-80">{caption}</p>
      )}

      <div
        className={clsx(
          'flex h-[52px] items-center gap-[10px] rounded-full px-[8px] transition-colors',
          'shadow-[0_1px_10px_rgba(10,10,10,0.06)]',
          recording ? 'bg-brand-tint-1' : 'bg-gray-10',
        )}
      >
        {typing ? (
          <button
            type="button"
            aria-label="Back to voice"
            onClick={() => onChange('')}
            className="flex size-[36px] shrink-0 items-center justify-center rounded-full border border-brand-border transition-transform active:scale-95"
          >
            <IconMicrophone className="size-[18px] text-brand-primary" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Attach"
            onClick={onPlus}
            disabled={recording}
            className="flex size-[36px] shrink-0 items-center justify-center rounded-full border border-brand-border transition-transform active:scale-95 disabled:opacity-40"
          >
            <IconPlus className="size-[18px] text-brand-primary" />
          </button>
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
            className="h-full min-w-0 flex-1 bg-transparent text-md text-gray-100 placeholder:text-gray-60 outline-none"
          />
        ) : (
          /* Hold to record, release to send, tap to type. */
          <button
            type="button"
            aria-label={recording ? 'Release to send' : placeholder}
            disabled={disabled}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => finishPress(true)}
            onPointerCancel={() => finishPress(false)}
            onPointerLeave={() => finishPress(false)}
            onContextMenu={(e) => e.preventDefault()}
            className="flex h-full min-w-0 flex-1 select-none touch-none items-center gap-[8px] disabled:opacity-50"
          >
            {recording ? (
              <>
                <span className="size-[8px] shrink-0 rounded-full bg-alert" />
                <span className="shrink-0 text-md tabular-nums text-gray-100">
                  {formatElapsed(elapsed)}
                </span>
                <span
                  className={clsx(
                    'flex flex-1 items-center justify-center gap-[2px] text-md',
                    cancelArmed ? 'font-bold text-alert' : 'text-gray-60',
                  )}
                >
                  <IconChevronLeft className="size-[14px]" />
                  {cancelArmed ? 'Release to cancel' : 'Slide to cancel'}
                </span>
              </>
            ) : (
              <span className="truncate pl-[6px] text-md text-gray-60">{placeholder}</span>
            )}
          </button>
        )}

        {typing ? (
          <button
            type="button"
            aria-label="Send"
            onClick={onSend}
            disabled={!value.trim() || disabled}
            className="flex size-[36px] shrink-0 items-center justify-center rounded-full bg-brand-primary transition-transform active:scale-95 disabled:opacity-40"
          >
            <IconArrowUp className="size-[18px] text-gray-10" />
          </button>
        ) : (
          <span
            className={clsx(
              'flex size-[36px] shrink-0 items-center justify-center rounded-full transition-colors',
              recording ? 'bg-brand-accent' : 'bg-brand-primary',
            )}
          >
            <IconMicrophone
              className={clsx('size-[18px]', recording ? 'text-brand-active' : 'text-gray-10')}
            />
          </span>
        )}
      </div>
    </div>
  );
}

/** Seconds since recording started; resets when it stops. */
function useElapsed(running: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!running) {
      setSecs(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => setSecs(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(id);
  }, [running]);
  return secs;
}

function formatElapsed(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}
