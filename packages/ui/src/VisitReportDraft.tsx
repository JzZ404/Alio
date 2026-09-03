'use client';

import clsx from 'clsx';
import { IconPills, IconMedicalRecord, IconHeart } from './icons';

export type DraftSeverity = 'none' | 'watch' | 'urgent';

export type ReportDraft = {
  vitals: string | null;
  mood: string | null;
  meds: string | null;
  /** Medication names with whether the elder actually took them. */
  medsTaken: { name: string; taken: boolean }[];
  severity: DraftSeverity;
};

export const EMPTY_DRAFT: ReportDraft = {
  vitals: null,
  mood: null,
  meds: null,
  medsTaken: [],
  severity: 'none',
};

const SEVERITY_STYLE: Record<DraftSeverity, string> = {
  none: 'bg-brand-tint-1 text-brand-primary',
  watch: 'bg-[#FDF0D5] text-[#B25E09]',
  urgent: 'bg-[#FDE7E9] text-[#C0293A]',
};

/**
 * VisitReportDraft — today's report as it fills in.
 *
 * This is the Log screen's background: the caregiver sees the document they
 * owe rather than a chat, and each field lands as they talk. Fields with no
 * data yet stay visible so the shape of what's missing is obvious.
 */
export function VisitReportDraft({
  patientName,
  dateLabel,
  timeLabel,
  draft,
  filling,
  className,
}: {
  patientName: string;
  dateLabel: string;
  timeLabel?: string;
  draft: ReportDraft;
  /** True while a note is being processed — pending fields pulse. */
  filling?: boolean;
  className?: string;
}) {
  const filledCount = [draft.vitals, draft.mood, draft.meds].filter(Boolean).length;

  return (
    <div className={clsx('flex flex-col', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[20px] font-bold text-black">Visit・{patientName}</p>
        <span className="shrink-0 text-[12px] font-bold text-gray-60 tabular-nums">
          {filledCount}/3
        </span>
      </div>
      <p className="mt-1 text-[14px] text-gray-60">
        {dateLabel}
        {timeLabel ? `・${timeLabel}` : ''}
      </p>

      <div className="mt-[18px] flex flex-col gap-[12px]">
        <DraftCard
          title="Vitals"
          icon={<IconHeart className="size-[18px] text-brand-primary" />}
          value={draft.vitals}
          hint="Blood pressure, pulse, temperature"
          filling={filling}
          severity={draft.severity}
        />
        <DraftCard
          title="Mood & Energy"
          icon={<IconMedicalRecord className="size-[18px] text-brand-primary" />}
          value={draft.mood}
          hint="How she seemed today"
          filling={filling}
          severity={draft.severity}
        />
        <DraftCard
          title="Meds"
          icon={<IconPills className="size-[18px] text-brand-primary" />}
          value={draft.meds}
          hint="Taken, missed, or refused"
          filling={filling}
          severity={draft.severity}
          extra={
            draft.medsTaken.length > 0 ? (
              <div className="mt-[10px] flex flex-wrap gap-x-3 gap-y-1 text-[14px] text-black">
                {draft.medsTaken.map((m) => (
                  <span key={m.name} className="inline-flex items-center gap-1">
                    {m.name}
                    <span className={m.taken ? 'text-[#12B76A]' : 'text-[#F65E69]'}>
                      {m.taken ? '✓' : '✕'}
                    </span>
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

function DraftCard({
  title,
  icon,
  value,
  hint,
  filling,
  severity,
  extra,
}: {
  title: string;
  icon: React.ReactNode;
  value: string | null;
  hint: string;
  filling?: boolean;
  severity: DraftSeverity;
  extra?: React.ReactNode;
}) {
  const empty = !value;

  return (
    <div
      className={clsx(
        'rounded-[16px] p-[16px] transition-colors',
        empty ? 'border border-dashed border-brand-border bg-white/40' : 'bg-white',
      )}
    >
      <div className="flex items-center gap-[8px]">
        <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-brand-tint-1">
          {icon}
        </span>
        <span className="text-[14px] font-bold text-gray-100">{title}</span>
        {!empty && severity !== 'none' && (
          <span
            className={clsx(
              'ml-auto rounded-full px-[10px] py-[3px] text-[11px] font-bold',
              SEVERITY_STYLE[severity],
            )}
          >
            {severity === 'urgent' ? 'Needs attention' : 'Watch'}
          </span>
        )}
      </div>

      {empty ? (
        <p
          className={clsx(
            'mt-[10px] text-[14px] text-gray-60',
            filling && 'animate-pulse',
          )}
        >
          {filling ? 'Listening for this…' : hint}
        </p>
      ) : (
        <>
          <p className="mt-[10px] text-[16px] leading-[22px] text-black">{value}</p>
          {extra}
        </>
      )}
    </div>
  );
}
