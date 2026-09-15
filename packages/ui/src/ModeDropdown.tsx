'use client';

import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { IconChevronDown } from './icons';

export type LogsMode = 'voice' | 'message';

export function ModeDropdown({
  mode,
  onChangeMode,
}: {
  mode: LogsMode;
  onChangeMode: (next: LogsMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-[42px] items-center gap-2 rounded-[10px] bg-brand-tint-1 shadow-lift px-3 transition-colors active:bg-brand-border"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="text-xl font-bold text-gray-100">Alio</span>
        <span className="text-md text-gray-100">{mode}</span>
        <IconChevronDown className={clsx('size-4 text-gray-100 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[50px] z-20 w-44 overflow-hidden rounded-xl border border-brand-border bg-white shadow-xl"
        >
          <MenuItem
            label="Voice"
            description="Recording view"
            active={mode === 'voice'}
            onClick={() => {
              onChangeMode('voice');
              setOpen(false);
            }}
          />
          <MenuItem
            label="Message"
            description="Conversation view"
            active={mode === 'message'}
            onClick={() => {
              onChangeMode('message');
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className={clsx(
        'flex w-full flex-col items-start px-4 py-2.5 text-left transition-colors hover:bg-brand-tint-1',
        active && 'bg-brand-tint-1',
      )}
    >
      <span className={clsx('text-sm font-bold', active ? 'text-brand-active' : 'text-gray-100')}>
        {label}
      </span>
      <span className="text-xs text-gray-60">{description}</span>
    </button>
  );
}
