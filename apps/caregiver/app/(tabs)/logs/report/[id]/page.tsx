'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  IconBox,
  IconChevronLeft,
} from '@alio/ui';
import {
  api,
  ApiError,
  type CompiledReportRow,
  type Severity,
  type VisitReport,
} from '@/lib/api';
import { supabase } from '@/lib/supabase';

const CAREGIVER_NAME = 'Sarah Mitchell';
const threadIdFor = (caregiverId: string, patientId: string) =>
  `${caregiverId}__${patientId}`;

type SendState = 'idle' | 'sending' | 'sent';

export default function LogReportPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [row, setRow] = useState<CompiledReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    api
      .getCompiledReport(id)
      .then((r) => {
        if (!cancelled) setRow(r);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof ApiError ? e.message : 'Could not load report.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSendToFamily() {
    if (!row || sendState !== 'idle') return;
    setSendError('');
    setSendState('sending');
    try {
      const { text } = await api.formatReportForFamily(
        row.patient_name,
        row.visit_date,
        row.report,
      );
      const { error: insertError } = await supabase.from('family_messages').insert({
        thread_id: threadIdFor(row.caregiver_id, row.patient_id),
        sender: CAREGIVER_NAME,
        text,
        report_id: row.id,
      });
      if (insertError) {
        setSendError(`Could not send: ${insertError.message}`);
        setSendState('idle');
        return;
      }
      setSendState('sent');
    } catch (e) {
      setSendError(e instanceof ApiError ? e.message : 'Could not format report.');
      setSendState('idle');
    }
  }

  return (
    <div
      className="relative h-full min-h-screen overflow-hidden sm:h-[852px] sm:min-h-0"
      style={{
        background: 'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      {/* Back + title */}
      <header className="absolute left-[25px] right-[25px] top-[60px] z-10 flex items-center gap-[16px]">
        <IconBox size={42} aria-label="Back" onClick={() => router.back()}>
          <IconChevronLeft className="size-6 text-gray-100" />
        </IconBox>
        <span className="flex h-[42px] items-center rounded-[10px] bg-brand-tint-1 px-[12px] text-[16px] font-bold text-black">
          Log Summary
        </span>
      </header>

      {loading ? (
        <p className="absolute left-0 right-0 top-[200px] text-center text-gray-60">Loading…</p>
      ) : loadError ? (
        <p className="absolute left-[24px] right-[24px] top-[200px] text-center text-sm text-red-600">
          {loadError}
        </p>
      ) : row ? (
        <ReportBody row={row} />
      ) : (
        <p className="absolute left-0 right-0 top-[200px] text-center text-gray-60">Not found.</p>
      )}

      {/* Send to family button */}
      {row && (
        <div className="absolute bottom-[170px] left-1/2 -translate-x-1/2 z-10 w-[349px]">
          <button
            type="button"
            onClick={handleSendToFamily}
            disabled={sendState !== 'idle'}
            className="flex h-[48px] w-full items-center justify-center rounded-[12px] bg-[#5E69F6] font-bold text-[14px] text-white transition-colors active:bg-[#4856ff] disabled:opacity-50"
          >
            {sendState === 'sending'
              ? 'Sending…'
              : sendState === 'sent'
                ? 'Sent ✓'
                : 'Send to family'}
          </button>
          {sendError && (
            <p className="mt-2 text-center text-sm text-red-600">{sendError}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ReportBody({ row }: { row: CompiledReportRow }) {
  const r = row.report;
  const vitalsValue = [r.vitals.bp, r.vitals.pulse, r.vitals.temp]
    .filter(Boolean)
    .join('   ') || '—';

  return (
    <div className="absolute left-0 right-0 top-[122px] bottom-[240px] overflow-y-auto px-[22px] py-[12px]">
      <p className="font-bold text-[20px] text-black">
        Visit・{row.patient_name}
      </p>
      <p className="mt-1 text-[14px] text-black">
        {formatVisitDate(row.visit_date)}
        {row.visit_time ? `・${row.visit_time}` : ''}
      </p>

      <div className="mt-[20px] flex flex-col gap-[12px]">
        <ReportCard
          title="Vitals"
          icon={<VitalsIcon />}
          primaryValue={vitalsValue}
          flag={r.vitals.flag}
        />
        <ReportCard
          title="Mood & Energy"
          icon={<MoodIcon />}
          primaryValue={r.mood.value || '—'}
          flag={r.mood.flag}
        />
        <ReportCard
          title="Meds"
          icon={<MedsIcon />}
          primaryValue={r.meds.status || '—'}
          flag={r.meds.flag}
          extra={
            r.meds.flag?.meds && r.meds.flag.meds.length > 0 ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[14px] text-black">
                {r.meds.flag.meds.map((m) => (
                  <span key={m.name} className="inline-flex items-center gap-1">
                    {m.name}
                    {m.taken ? (
                      <CheckIcon className="size-[14px] text-[#12B76A]" />
                    ) : (
                      <CrossIcon className="size-[14px] text-[#F65E69]" />
                    )}
                  </span>
                ))}
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}

function ReportCard({
  title,
  icon,
  primaryValue,
  flag,
  extra,
}: {
  title: string;
  icon: React.ReactNode;
  primaryValue: string;
  flag: { severity: Severity; label: string; note: string | null };
  extra?: React.ReactNode;
}) {
  const flagColor =
    flag.severity === 'critical' ? 'text-[#F65E69]'
    : flag.severity === 'warning' ? 'text-[#F79009]'
    : flag.severity === 'good'    ? 'text-[#12B76A]'
                                  : 'text-gray-60';

  return (
    <div className="rounded-[12px] bg-[#EAEAF2] pl-[12px] pr-[16px]">
      <div className="flex h-[72px] items-center justify-between border-b border-[#d3d5ec]">
        <div className="flex flex-1 items-center gap-[12px] min-w-0">
          <div className="flex size-[40px] shrink-0 items-center justify-center rounded-[8px] bg-brand-tint-2 p-[5px]">
            {icon}
          </div>
          <div className="flex flex-1 flex-col gap-[8px]">
            <div className="flex items-center gap-[8px]">
              <p className="font-bold text-[16px] text-black">{title}</p>
              {flag.severity !== 'none' && <SeverityDot severity={flag.severity} />}
            </div>
            <p className="text-[14px] text-black truncate">{primaryValue}</p>
          </div>
        </div>
        <EditButton />
      </div>

      {(flag.severity !== 'none' || extra) && (
        <div className="flex min-h-[72px] flex-col justify-center gap-[6px] py-[12px]">
          {flag.severity !== 'none' && flag.label && (
            <p className={`font-bold text-[16px] ${flagColor}`}>{flag.label}</p>
          )}
          {flag.note && <p className="text-[14px] text-black">{flag.note}</p>}
          {extra}
        </div>
      )}
    </div>
  );
}

function SeverityDot({ severity }: { severity: Severity }) {
  const bg =
    severity === 'critical' ? 'bg-[#F65E69]'
    : severity === 'warning' ? 'bg-[#F79009]'
    : 'bg-[#12B76A]';
  return (
    <span className={`flex size-[16px] items-center justify-center rounded-full ${bg}`}>
      <span className="text-[10px] font-bold text-white">!</span>
    </span>
  );
}

function EditButton() {
  return (
    <button
      type="button"
      aria-label="Edit section"
      className="flex size-[32px] items-center justify-center rounded-[12px] bg-brand-tint-2 p-[8px] transition-colors active:bg-brand-border"
    >
      <svg viewBox="0 0 24 24" className="size-[16px] text-gray-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </button>
  );
}

function VitalsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[24px] text-gray-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l3-9 4 18 3-9h4" />
    </svg>
  );
}

function MoodIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[24px] text-gray-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function MedsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[24px] text-gray-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  // iso = "YYYY-MM-DD" → "Mon DD" (Apr 27)
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
