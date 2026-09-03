'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

/** How far you have to drag before the sheet changes state. */
const SNAP_PX = 48;

/** Height of the grab handle strip. */
const HANDLE_H = 30;

/**
 * PullUpSheet — a drawer that wraps the control it belongs to.
 *
 * The `footer` (an input bar, say) is always visible and forms the sheet's
 * bottom edge. Collapsed, that footer is all you see and the surface behind it
 * is transparent, so it reads as a floating bar. Drag or tap the handle and the
 * sheet grows upward from behind the footer to reveal `children`.
 */
export function PullUpSheet({
  open,
  onOpenChange,
  title,
  count,
  children,
  footer,
  expandedHeight = '58vh',
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  count?: number;
  children: ReactNode;
  footer: ReactNode;
  expandedHeight?: string;
  className?: string;
}) {
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const dragging = startY.current !== null;

  // Collapse to exactly the handle plus the footer, measured rather than
  // guessed — if the collapsed height is short the footer gets nudged, and the
  // whole point is that the input does not move when the sheet opens.
  const footerRef = useRef<HTMLDivElement | null>(null);
  const [footerH, setFooterH] = useState(0);
  useLayoutEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const measure = () => setFooterH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const collapsedHeight = HANDLE_H + footerH;

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
        'flex flex-col overflow-hidden rounded-t-[22px] transition-colors',
        open
          ? 'bg-white/75 shadow-[0_-6px_28px_rgba(0,0,0,0.12)] backdrop-blur-xl'
          : 'bg-transparent',
        !dragging && 'transition-[height] duration-200 ease-out',
        className,
      )}
      style={{
        height: open
          ? `calc(${expandedHeight} - ${dragY}px)`
          : `${collapsedHeight - dragY}px`,
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
        style={{ height: HANDLE_H }}
        className="relative flex w-full shrink-0 touch-none select-none items-center justify-center gap-[7px]"
      >
        <span
          className={clsx(
            'h-[4px] w-[38px] rounded-full transition-colors',
            open ? 'bg-gray-30' : 'bg-gray-30/70',
          )}
        />
        {!open && typeof count === 'number' && count > 0 && (
          <span className="absolute right-[20px] rounded-full bg-white/80 px-[9px] py-[2px] text-[11px] font-bold text-brand-primary shadow-sm backdrop-blur-sm tabular-nums">
            {title} {count}
          </span>
        )}
      </button>

      {/* Conversation — only reachable once the sheet is up. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-[12px]">{children}</div>

      {/* The control the sheet wraps. Always visible; forms the bottom edge. */}
      <div ref={footerRef} className="shrink-0 px-[12px] pb-[14px] pt-[10px]">
        {footer}
      </div>
    </div>
  );
}
