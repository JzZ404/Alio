'use client';

import clsx from 'clsx';
import { IconChevronRight, IconMedicalRecord } from '@alio/ui';
import type { CompiledReportRow } from '@/lib/supabase';

/**
 * VisitRecordItem — single row in the Records list for a caregiver visit
 * report. Visually matches RecordItem from @alio/ui but pulls its data from
 * the compiled_reports table (Supabase) instead of the SAMPLE_RECORDS mock.
 */
export function VisitRecordItem({
  row,
  onClick,
}: {
  row: CompiledReportRow;
  onClick?: () => void;
}) {
  const date = formatLongDate(row.visit_date);
  const title = `Visit · ${row.patient_name}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex h-[70px] w-full items-center gap-[12px] rounded-[12px] bg-brand-tint-1 pl-[14px] pr-[16px]',
        'transition-colors active:bg-brand-border',
      )}
    >
      <span className="flex size-[48px] shrink-0 items-center justify-center rounded-[10px] bg-white">
        <IconMedicalRecord className="size-[24px] text-brand-primary" />
      </span>
      <div className="flex flex-1 flex-col gap-[4px] text-left leading-none">
        <span className="text-[14px] font-bold text-[#28292C]">{title}</span>
        <span className="text-[12px] font-bold text-[#6C6E76]">
          Visit report | {date}
        </span>
      </div>
      <IconChevronRight className="size-[20px] shrink-0 text-brand-primary" />
    </button>
  );
}

function formatLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}
