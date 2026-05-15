'use client';

import { useRouter } from 'next/navigation';
import {
  PatientCard,
  IconBox,
  IconProfile,
  IconNotificationFilled,
  IconPlus,
} from '@alio/ui';
import { SAMPLE_PATIENTS, SAMPLE_CG_USER } from '@alio/mock-data';

/**
 * Caregiver Home — Figma CG-Home (390:4831) + CG-Home-patientcarddropdown (390:4151).
 *
 * Layout (top to bottom):
 *   1. User header (caregiver avatar + name + role + 2 action buttons)
 *   2. "Upcoming Schedule" title + add button
 *   3. List of patient cards (first is expanded by default)
 */
export default function CaregiverHomePage() {
  const router = useRouter();

  return (
    <div
      className="relative h-full min-h-screen overflow-y-auto pb-32 sm:h-[852px] sm:min-h-0"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      {/* Header — caregiver identity + actions, positioned at the consistent top-60 */}
      <header className="flex items-center gap-[14px] px-[20px] pt-[60px]">
        <span className="size-[52px] shrink-0 overflow-hidden rounded-full">
          {SAMPLE_CG_USER.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={SAMPLE_CG_USER.avatarUrl}
              alt={SAMPLE_CG_USER.name}
              width={52}
              height={52}
              className="size-full object-cover"
            />
          ) : (
            <span className="size-full rounded-full bg-brand-primary/50" />
          )}
        </span>
        <div className="flex flex-1 flex-col leading-none">
          <span className="text-[20px] font-bold text-gray-100">{SAMPLE_CG_USER.name}</span>
          <span className="mt-[6px] text-[14px] text-gray-60">{SAMPLE_CG_USER.role}</span>
        </div>
        <IconBox
          size={42}
          shape="rounded"
          aria-label="Profile"
          onClick={() => router.push('/profiles')}
        >
          <IconProfile className="size-[22px] text-gray-100" />
        </IconBox>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-[42px] items-center justify-center rounded-lg bg-brand-tint-1 transition-colors active:bg-brand-border"
        >
          <IconNotificationFilled className="size-[22px] text-gray-100" />
          {SAMPLE_CG_USER.notifications > 0 && (
            <span className="absolute -right-[4px] -top-[4px] flex size-[18px] items-center justify-center rounded-full bg-brand-primary text-[11px] font-bold text-white">
              {SAMPLE_CG_USER.notifications}
            </span>
          )}
        </button>
      </header>

      {/* Lab Report upload — quick entry point to the fine-tuned model */}
      <button
        type="button"
        onClick={() => router.push('/labs')}
        className="mx-[20px] mt-[24px] flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 shadow-sm transition-colors active:bg-white/90"
        style={{ width: 'calc(100% - 40px)' }}
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand-primary/15 text-2xl">
          🧪
        </span>
        <span className="flex flex-1 flex-col items-start leading-tight">
          <span className="text-[15px] font-bold text-gray-100">Upload Lab Report</span>
          <span className="text-[12px] text-gray-60">PDF or photo · explained in plain language, offline</span>
        </span>
        <span className="text-xl text-gray-60">→</span>
      </button>

      {/* Section title + add */}
      <div className="mt-[28px] flex items-center justify-between px-[20px]">
        <h2 className="text-[18px] font-bold text-gray-100">Upcoming Schedule</h2>
        <button
          type="button"
          aria-label="Add to schedule"
          className="flex size-[28px] items-center justify-center rounded-md transition-colors active:bg-brand-tint-1"
        >
          <IconPlus className="size-[22px] text-gray-100" />
        </button>
      </div>

      {/* Patient list — first expanded by default (matches dropdown screen) */}
      <div className="mt-[12px] flex flex-col gap-[10px] px-[16px]">
        {SAMPLE_PATIENTS.map((p, i) => (
          <PatientCard
            key={p.id}
            patient={p}
            defaultExpanded={i === 0}
            mapImageUrl="/map/map.png"
          />
        ))}
      </div>
    </div>
  );
}
