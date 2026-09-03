'use client';

import { useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

/** How far you have to drag before the sheet changes state. */
const SNAP_PX = 48;

/**
 * PullUpSheet — a drawer that lives under the page's own controls.
 *
 * Collapsed it is just a grab handle with a title; drag it up (or tap the
 * handle) to read the contents. Used for the Log conversation so the report
 * behind it stays the main thing on screen.
 */
export function PullUpSheet({
  open,
  onOpenChange,
  title,
  count,
  children,
  expandedHeight = '52vh',
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  count?: number;
  children: ReactNode;
  expandedHeight?: string;
  className?: string;
}) {
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    setDragY(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startY.current === null) return;
    const dy = e.clientY - startY.current;
    // Only allow dragging in the direction that makes sense for the state.
    setDragY(open ? Math.max(0, dy) : Math.min(0, dy));
  };

  const endDrag = () => {
    if (startY.current === null) return;
    const dy = dragY;
    startY.current = null;
    setDragY(0);
    if (!open && dy < -SNAP_PX) onOpenChange(true);
    else if (open && dy > SNAP_PX) onOpenChange(false);
  };

  return (
    <div
      className={clsx(
        'flex flex-col overflow-hidden rounded-t-[20px] bg-white/75 shadow-[0_-6px_28px_rgba(0,0,0,0.12)] backdrop-blur-xl',
        startY.current === null && 'transition-[height] duration-200 ease-out',
        className,
      )}
      style={{
        height: open ? `calc(${expandedHeight} - ${dragY}px)` : `${44 - dragY}px`,
      }}
    >
      {/* Grab handle — drag to resize, tap to toggle. */}
      <button
        type="button"
        aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
        aria-expanded={open}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onClick={() => onOpenChange(!open)}
        className="relative flex h-[44px] w-full shrink-0 touch-none select-none items-center gap-[8px] px-[16px] pt-[6px]"
      >
        <span className="absolute left-1/2 top-[7px] h-[4px] w-[38px] -translate-x-1/2 rounded-full bg-gray-30" />
        <span className="text-[13px] font-bold text-gray-100">{title}</span>
        {typeof count === 'number' && count > 0 && (
          <span className="rounded-full bg-brand-tint-1 px-[8px] py-[1px] text-[11px] font-bold text-brand-primary tabular-nums">
            {count}
          </span>
        )}
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto px-[12px]">{children}</div>
    </div>
  );
}
