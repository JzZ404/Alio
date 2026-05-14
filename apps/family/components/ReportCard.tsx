'use client';

import { useEffect, useState } from 'react';
import {
  fetchCompiledReport,
  type CompiledReportRow,
  type Severity,
  type VisitReport,
} from '@/lib/supabase';

/**
 * Inline structured visit report rendered inside a family chat thread.
 * Loads the row from /caregiver-logs/report/<id> on mount and shows the
 * same Vitals / Mood & Energy / Meds layout the caregiver sees.
 */
export function ReportCard({ reportId }: { reportId: string }) {
  const [row, setRow] = useState<CompiledReportRow | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchCompiledReport(reportId)
      .then((r) => {
        if (!cancelled) setRow(r);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'load failed');
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  if (err) {
    return (
      <div className="max-w-[320px] rounded-2xl bg-white px-4 py-3 text-sm text-red-600 shadow-sm">
        Could not load report — {err}
      </div>
    );
  }
  if (!row) {
    return (
      <div className="max-w-[320px] rounded-2xl bg-white px-4 py-3 text-sm text-gray-60 shadow-sm">
        Loading report…
      </div>
    );
  }

  const r = row.report;
  const vitalsValue =
    [r.vitals.bp, r.vitals.pulse, r.vitals.temp].filter(Boolean).join('   ') || '—';

  return (
    <div className="flex w-full max-w-[320px] flex-col gap-[8px] rounded-3xl bg-white p-3 shadow-sm">
      <div>
        <p className="text-[14px] font-bold text-black">
          Visit・{row.patient_name}
        </p>
        <p className="text-[11px] text-gray-60">
          {formatVisitDate(row.visit_date)}
          {row.visit_time ? `・${row.visit_time}` : ''}
        </p>
      </div>

      <Section
        title="Vitals"
        icon={<VitalsIcon />}
        value={vitalsValue}
        flag={r.vitals.flag}
      />
      <Section
        title="Mood & Energy"
        icon={<MoodIcon />}
        value={r.mood.value || '—'}
        flag={r.mood.flag}
      />
      <Section
        title="Meds"
        icon={<MedsIcon />}
        value={r.meds.status || '—'}
        flag={r.meds.flag}
        extra={
          r.meds.flag?.meds && r.meds.flag.meds.length > 0 ? (
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[12px] text-black">
              {r.meds.flag.meds.map((m) => (
                <span key={m.name} className="inline-flex items-center gap-1">
                  {m.name}
                  {m.taken ? (
                    <CheckIcon className="size-[12px] text-[#12B76A]" />
                  ) : (
                    <CrossIcon className="size-[12px] text-[#F65E69]" />
                  )}
                </span>
              ))}
            </div>
          ) : null
        }
      />
    </div>
  );
}

function Section({
  title,
  icon,
  value,
  flag,
  extra,
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  flag: { severity: Severity; label: string; note: string | null };
  extra?: React.ReactNode;
}) {
  const flagColor =
    flag.severity === 'critical'
      ? 'text-[#F65E69]'
      : flag.severity === 'warning'
        ? 'text-[#F79009]'
        : flag.severity === 'good'
          ? 'text-[#12B76A]'
          : 'text-gray-60';

  return (
    <div className="rounded-[12px] bg-[#EAEAF2] px-[10px] py-[8px]">
      <div className="flex items-center gap-[10px]">
        <div className="flex size-[32px] shrink-0 items-center justify-center rounded-[8px] bg-brand-tint-2 p-[5px]">
          {icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-[6px]">
            <p className="text-[13px] font-bold text-black">{title}</p>
            {flag.severity !== 'none' && <SeverityDot severity={flag.severity} />}
          </div>
          <p className="truncate text-[12px] text-black">{value}</p>
        </div>
      </div>
      {(flag.severity !== 'none' || extra) && (
        <div className="mt-[6px] flex flex-col gap-[4px] border-t border-[#d3d5ec] pt-[6px]">
          {flag.severity !== 'none' && flag.label && (
            <p className={`text-[13px] font-bold ${flagColor}`}>{flag.label}</p>
          )}
          {flag.note && <p className="text-[12px] text-black">{flag.note}</p>}
          {extra}
        </div>
      )}
    </div>
  );
}

function SeverityDot({ severity }: { severity: Severity }) {
  const bg =
    severity === 'critical'
      ? 'bg-[#F65E69]'
      : severity === 'warning'
        ? 'bg-[#F79009]'
        : 'bg-[#12B76A]';
  return (
    <span className={`flex size-[14px] items-center justify-center rounded-full ${bg}`}>
      <span className="text-[9px] font-bold text-white">!</span>
    </span>
  );
}

function VitalsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] text-gray-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l3-9 4 18 3-9h4" />
    </svg>
  );
}

function MoodIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] text-gray-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function MedsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] text-gray-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.5 20.5a4.95 4.95 0 0 1-7-7l9-9a4.95 4.95 0 0 1 7 7l-9 9z" />
      <path d="M8.5 8.5l7 7" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function formatVisitDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
