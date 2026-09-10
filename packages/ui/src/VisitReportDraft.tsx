'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  IconPills,
  IconMedicalRecord,
  IconHeart,
  IconBloodPressure,
  IconHeartRate,
  IconThermometer,
  IconEdit,
  IconClose,
} from './icons';
import {
  EMPTY_REPORT_DRAFT,
  type DraftSeverity,
  type ReportDraft,
  type VitalReadings,
} from '@alio/mock-data';

/** The free-text fields. Vitals are structured, so they edit separately. */
export type DraftField = 'summary' | 'mood' | 'meds';

const VITAL_ROWS = [
  { key: 'bp' as const, label: 'Blood pressure', Icon: IconBloodPressure, placeholder: '116/70' },
  { key: 'pulse' as const, label: 'Heart rate', Icon: IconHeartRate, placeholder: '72 bpm' },
  { key: 'temp' as const, label: 'Temperature', Icon: IconThermometer, placeholder: '98.4°F' },
];

export const EMPTY_DRAFT = EMPTY_REPORT_DRAFT;

const SEVERITY_STYLE: Record<DraftSeverity, string> = {
  none: 'bg-brand-tint-1 text-brand-primary',
  watch: 'bg-[#FDF0D5] text-[#B25E09]',
  urgent: 'bg-[#FDE7E9] text-[#C0293A]',
};

/**
 * VisitReportDraft — today's report as it fills in.
 *
 * This is the Log screen's background: the caregiver sees the document they
 * owe rather than a chat, and each field lands as they talk. Every section is
 * editable, because the caregiver signs off on what gets sent — the model
 * drafts, the person decides.
 */
export function VisitReportDraft({
  patientName,
  dateLabel,
  timeLabel,
  draft,
  filling,
  onEdit,
  onEditVitals,
  className,
}: {
  patientName: string;
  dateLabel: string;
  timeLabel?: string;
  draft: ReportDraft;
  /** True while a note is being processed — pending fields pulse. */
  filling?: boolean;
  onEdit?: (field: DraftField, value: string) => void;
  onEditVitals?: (v: VitalReadings) => void;
  className?: string;
}) {
  const anyVital = Boolean(draft.vitals.bp || draft.vitals.pulse || draft.vitals.temp);
  const filledCount = [anyVital, Boolean(draft.mood), Boolean(draft.meds)].filter(Boolean).length;

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

      <SummaryCard
        value={draft.summary}
        filling={filling}
        severity={draft.severity}
        onEdit={onEdit ? (v) => onEdit('summary', v) : undefined}
      />

      <div className="mt-[12px] flex flex-col gap-[12px]">
        <VitalsCard
          vitals={draft.vitals}
          filling={filling}
          onEdit={onEditVitals}
        />
        <DraftCard
          title="Mood & Energy"
          icon={<IconMedicalRecord className="size-[18px] text-brand-primary" />}
          value={draft.mood}
          hint="How she seemed today"
          filling={filling}
          onEdit={onEdit ? (v) => onEdit('mood', v) : undefined}
        />
        <DraftCard
          title="Meds"
          icon={<IconPills className="size-[18px] text-brand-primary" />}
          value={draft.meds}
          hint="Taken, missed, or refused"
          filling={filling}
          onEdit={onEdit ? (v) => onEdit('meds', v) : undefined}
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

/**
 * VitalsCard — three readings kept visually apart.
 *
 * Each one keeps its own icon, label and value, because a caregiver skimming
 * the report needs to see which number is the blood pressure without parsing a
 * run-on string.
 */
function VitalsCard({
  vitals,
  filling,
  onEdit,
}: {
  vitals: VitalReadings;
  filling?: boolean;
  onEdit?: (v: VitalReadings) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(vitals);
  const empty = !vitals.bp && !vitals.pulse && !vitals.temp;

  if (editing && onEdit) {
    return (
      <div className="rounded-[16px] bg-white p-[16px] ring-2 ring-brand-primary">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold text-gray-100">Vitals</span>
          <button
            type="button"
            aria-label="Cancel edit"
            onClick={() => setEditing(false)}
            className="flex size-[26px] items-center justify-center rounded-full bg-brand-tint-1 transition-transform active:scale-95"
          >
            <IconClose className="size-[14px] text-gray-100" />
          </button>
        </div>

        <div className="mt-[12px] flex flex-col gap-[10px]">
          {VITAL_ROWS.map(({ key, label, Icon, placeholder }) => (
            <label key={key} className="flex items-center gap-[10px]">
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[8px] bg-brand-tint-2">
                <Icon className="size-[18px] text-brand-primary" />
              </span>
              <span className="w-[100px] shrink-0 text-[12px] font-bold text-gray-60">{label}</span>
              <input
                type="text"
                value={draft[key] ?? ''}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                placeholder={placeholder}
                className="h-[36px] min-w-0 flex-1 rounded-[10px] bg-brand-tint-1 px-[10px] text-[14px] font-bold text-gray-100 placeholder:font-normal placeholder:text-gray-60 outline-none"
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            onEdit({
              bp: draft.bp?.trim() || null,
              pulse: draft.pulse?.trim() || null,
              temp: draft.temp?.trim() || null,
            });
            setEditing(false);
          }}
          className="mt-[12px] h-[38px] w-full rounded-[10px] bg-brand-primary text-[13px] font-bold text-gray-10 transition-transform active:scale-95"
        >
          Save
        </button>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'rounded-[16px] p-[16px] transition-colors',
        empty ? 'border border-dashed border-brand-border bg-white/40' : 'bg-white',
      )}
    >
      <div className="flex items-center gap-[8px]">
        <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-brand-tint-1">
          <IconHeart className="size-[18px] text-brand-primary" />
        </span>
        <span className="text-[14px] font-bold text-gray-100">Vitals</span>
        {onEdit && (
          <button
            type="button"
            aria-label="Edit Vitals"
            onClick={() => {
              setDraft(vitals);
              setEditing(true);
            }}
            className="ml-auto flex size-[26px] items-center justify-center rounded-full bg-brand-tint-1 transition-transform active:scale-95"
          >
            <IconEdit className="size-[14px] text-brand-primary" />
          </button>
        )}
      </div>

      {empty ? (
        <p className={clsx('mt-[10px] text-[14px] text-gray-60', filling && 'animate-pulse')}>
          {filling ? 'Listening for this…' : 'Blood pressure, pulse, temperature'}
        </p>
      ) : (
        <div className="mt-[12px] grid grid-cols-3 gap-[8px]">
          {VITAL_ROWS.map(({ key, label, Icon }) => (
            <div
              key={key}
              className="flex flex-col items-start gap-[6px] rounded-[12px] bg-brand-tint-2 p-[10px]"
            >
              <span className="flex size-[24px] items-center justify-center rounded-[7px] bg-gray-10">
                <Icon className="size-[15px] text-brand-primary" />
              </span>
              <span className="text-[10px] font-bold leading-none text-gray-60">{label}</span>
              <span className="text-[14px] font-bold leading-none text-gray-100">
                {vitals[key] ?? '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The headline the family will read first, so it sits above the detail. */
function SummaryCard({
  value,
  filling,
  severity,
  onEdit,
}: {
  value: string | null;
  filling?: boolean;
  severity: DraftSeverity;
  onEdit?: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing && onEdit) {
    return (
      <InlineEditor
        initial={value ?? ''}
        placeholder="Summarise the visit in a sentence…"
        rows={3}
        onCancel={() => setEditing(false)}
        onSave={(v) => {
          onEdit(v);
          setEditing(false);
        }}
        className="mt-[18px]"
      />
    );
  }

  return (
    <div
      className={clsx(
        'mt-[18px] rounded-[16px] p-[16px]',
        value
          ? 'bg-brand-primary text-white'
          : 'border border-dashed border-brand-border bg-white/40',
      )}
    >
      <div className="flex items-center gap-[8px]">
        <span
          className={clsx(
            'text-[12px] font-bold uppercase tracking-[0.06em]',
            value ? 'text-white/70' : 'text-gray-60',
          )}
        >
          Summary
        </span>
        {value && severity !== 'none' && (
          <span
            className={clsx(
              'ml-auto rounded-full px-[10px] py-[3px] text-[11px] font-bold',
              SEVERITY_STYLE[severity],
            )}
          >
            {severity === 'urgent' ? 'Needs attention' : 'Watch'}
          </span>
        )}
        {onEdit && (
          <button
            type="button"
            aria-label="Edit summary"
            onClick={() => setEditing(true)}
            className={clsx(
              'flex size-[26px] items-center justify-center rounded-full transition-transform active:scale-95',
              value ? 'bg-white/20' : 'ml-auto bg-brand-tint-1',
            )}
          >
            <IconEdit className={clsx('size-[14px]', value ? 'text-white' : 'text-brand-primary')} />
          </button>
        )}
      </div>

      {value ? (
        <p className="mt-[10px] text-[17px] leading-[24px]">{value}</p>
      ) : (
        <p className={clsx('mt-[10px] text-[14px] text-gray-60', filling && 'animate-pulse')}>
          {filling ? 'Writing the summary…' : 'The line the family reads first'}
        </p>
      )}
    </div>
  );
}

function DraftCard({
  title,
  icon,
  value,
  hint,
  filling,
  extra,
  onEdit,
}: {
  title: string;
  icon: React.ReactNode;
  value: string | null;
  hint: string;
  filling?: boolean;
  extra?: React.ReactNode;
  onEdit?: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const empty = !value;

  if (editing && onEdit) {
    return (
      <InlineEditor
        initial={value ?? ''}
        placeholder={hint}
        rows={2}
        label={title}
        onCancel={() => setEditing(false)}
        onSave={(v) => {
          onEdit(v);
          setEditing(false);
        }}
      />
    );
  }

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
        <div className="ml-auto flex items-center gap-[8px]">
          {onEdit && (
            <button
              type="button"
              aria-label={`Edit ${title}`}
              onClick={() => setEditing(true)}
              className="flex size-[26px] items-center justify-center rounded-full bg-brand-tint-1 transition-transform active:scale-95"
            >
              <IconEdit className="size-[14px] text-brand-primary" />
            </button>
          )}
        </div>
      </div>

      {empty ? (
        <p className={clsx('mt-[10px] text-[14px] text-gray-60', filling && 'animate-pulse')}>
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

/** Shared inline editor so every section is corrected the same way. */
function InlineEditor({
  initial,
  placeholder,
  rows,
  label,
  onSave,
  onCancel,
  className,
}: {
  initial: string;
  placeholder: string;
  rows: number;
  label?: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.setSelectionRange(text.length, text.length);
    // Focus once on mount; re-running would fight the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={clsx('rounded-[16px] bg-white p-[16px] ring-2 ring-brand-primary', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold text-gray-100">{label ?? 'Summary'}</span>
        <button
          type="button"
          aria-label="Cancel edit"
          onClick={onCancel}
          className="flex size-[26px] items-center justify-center rounded-full bg-brand-tint-1 transition-transform active:scale-95"
        >
          <IconClose className="size-[14px] text-gray-100" />
        </button>
      </div>
      <textarea
        ref={ref}
        rows={rows}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="mt-[10px] w-full resize-none rounded-[12px] bg-brand-tint-1 px-[12px] py-[10px] text-[15px] leading-[21px] text-gray-100 placeholder:text-gray-60 outline-none"
      />
      <button
        type="button"
        onClick={() => onSave(text.trim())}
        className="mt-[10px] h-[38px] w-full rounded-[10px] bg-brand-primary text-[13px] font-bold text-white transition-transform active:scale-95"
      >
        Save
      </button>
    </div>
  );
}
