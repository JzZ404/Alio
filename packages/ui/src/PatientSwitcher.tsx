'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { IconChevronDown } from './icons';
import type { Patient } from '@alio/mock-data';

/**
 * PatientSwitcher — top-left dropdown used in Caregiver /logs and Family /ai-check.
 * Shows the active patient avatar + name + chevron. Opening reveals the other
 * patients so the user can switch context.
 */
export function PatientSwitcher({
  patients,
  activeId,
  onChange,
  className,
}: {
  patients: Patient[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const active = patients.find((p) => p.id === activeId) ?? patients[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={clsx('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-[42px] items-center gap-[8px] rounded-[10px] bg-brand-tint-1 shadow-lift pl-[6px] pr-[12px] transition-colors active:bg-brand-border"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="size-[32px] shrink-0 overflow-hidden rounded-full">
          {active?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={active.avatarUrl}
              alt={active.name}
              width={32}
              height={32}
              className="size-full object-cover"
            />
          ) : (
            <span className="size-full rounded-full bg-gray-30" />
          )}
        </span>
        <span className="text-[16px] font-bold text-black whitespace-nowrap">
          {active?.name ?? 'Patient'}
        </span>
        <IconChevronDown
          className={clsx('size-4 text-gray-100 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[50px] z-20 w-[240px] overflow-hidden rounded-xl border border-brand-border bg-white shadow-xl"
        >
          {patients.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(p.id);
                setOpen(false);
              }}
              className={clsx(
                'flex w-full items-center gap-[10px] px-[12px] py-[10px] text-left transition-colors hover:bg-brand-tint-1',
                p.id === activeId && 'bg-brand-tint-1',
              )}
            >
              <span className="size-[36px] shrink-0 overflow-hidden rounded-full">
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarUrl} alt={p.name} width={36} height={36} className="size-full object-cover" />
                ) : (
                  <span className="size-full rounded-full bg-gray-30" />
                )}
              </span>
              <div className="flex flex-col leading-tight">
                <span
                  className={clsx(
                    'text-[14px] font-bold',
                    p.id === activeId ? 'text-brand-active' : 'text-gray-100',
                  )}
                >
                  {p.name}
                </span>
                <span className="text-[11px] text-gray-60">{p.time} · {p.address}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
