'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  PatientCard,
  IconBox,
  IconProfile,
  IconNotificationFilled,
  IconPlus,
  formatBadge,
} from '@alio/ui';
import { SAMPLE_PATIENTS, SAMPLE_CG_USER } from '@alio/mock-data';
import { useCaregiverPending } from '@/lib/use-caregiver-pending';

/**
 * Caregiver Home — Figma CG-Home (390:4831) + CG-Home-patientcarddropdown (390:4151).
 *
 * Layout (top to bottom):
 *   1. User header (caregiver avatar + name + role + 2 action buttons)
 *   2. "Upcoming Schedule" title + add button
 *   3. List of patient cards (first is expanded by default)
 */
export default function CaregiverHomePage({ onOpenPending }: { onOpenPending?: () => void } = {}) {
  const router = useRouter();

  // The bell is a second door into the Pending screen (spec §2.1), so its
  // badge reads the same merge that screen and the Inbox cards read. It used
  // to render a hardcoded fixture count, which never moved however much the
  // caregiver confirmed.
  const now = useMemo(() => new Date(), []);
  const { pending } = useCaregiverPending(now);
  const badge = formatBadge(pending.length);

  return (
    <div
      className="relative h-full overflow-y-auto pb-32"
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
          onClick={onOpenPending}
          className="relative flex size-[42px] items-center justify-center rounded-lg bg-brand-tint-1 transition-colors active:bg-brand-border"
        >
          <IconNotificationFilled className="size-[22px] text-gray-100" />
          {/* No badge at zero — the icon stays, and stays quiet (spec §2.1).
              `min-w` rather than a fixed square so the capped `9+` still fits. */}
          {badge && (
            <span className="absolute -right-[4px] -top-[4px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-primary px-[4px] text-[11px] font-bold text-white">
              {badge}
            </span>
          )}
        </button>
      </header>

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
