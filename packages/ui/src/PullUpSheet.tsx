'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

/** How far you have to drag before the sheet changes state. */
const SNAP_PX = 48;

/** Height of the grab handle strip. */
const HANDLE_H = 30;

/**
 * PullUpSheet — one surface that wraps the control it belongs to.
 *
 * The `footer` (the voice dock) always shows and forms the bottom edge; the
 * surface behind it is the same surface the dock sits on, so there is no card
 * inside a card. Drag or tap the handle and it grows upward to reveal
 * `children`.
 */
export function PullUpSheet({
  open,
  onOpenChange,
  label,
  children,
  footer,
  expandedHeight = '42vh',
  onHeightChange,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name for the handle; never rendered. */
  label: string;
  children: ReactNode;
  footer: ReactNode;
  expandedHeight?: string;
  /** Reports the collapsed height so the page can clear the dock. */
  onHeightChange?: (px: number) => void;
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
    const measure = () => {
      const h = el.getBoundingClientRect().height;
      setFooterH(h);
      onHeightChange?.(HANDLE_H + h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange]);
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
        'flex flex-col overflow-hidden rounded-t-2xl bg-brand-tint-2/90',
        'shadow-[0_-6px_28px_rgba(10,10,10,0.10)] backdrop-blur-xl',
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
        aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
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
        <span className="h-[4px] w-[38px] rounded-full bg-gray-30" />
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
