'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { IconChevronDown, IconMapsFilled, IconHandphone, IconChat, IconChecklistCircleFilled } from './icons';
import type { Patient } from '@alio/mock-data';

/**
 * PatientCard — row on the Caregiver Home "Upcoming Schedule" list.
 * Collapsed: avatar + name + time + short address + chevron.
 * Expanded: adds full address with map icon, map preview, and emergency contacts.
 *
 * Figma: CG-Home (390:4831) collapsed state; CG-Home-patientcarddropdown (390:4151) expanded.
 */
export function PatientCard({
  patient,
  defaultExpanded,
  mapImageUrl,
}: {
  patient: Patient;
  defaultExpanded?: boolean;
  mapImageUrl?: string;
}) {
  const [expanded, setExpanded] = useState(!!defaultExpanded);
  const [arrived, setArrived] = useState(false);

  return (
    <div className="flex flex-col gap-[12px] rounded-[16px] bg-brand-tint-1 p-[14px]">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex items-center gap-[12px] text-left"
      >
        <span className="size-[40px] shrink-0 overflow-hidden rounded-full">
          {patient.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={patient.avatarUrl}
              alt={patient.name}
              width={40}
              height={40}
              className="size-full object-cover"
            />
          ) : (
            <span className="size-full rounded-full bg-brand-primary/30" />
          )}
        </span>
        <div className="flex flex-1 flex-col gap-[2px]">
          <span className="text-[16px] font-bold text-gray-100 leading-none">{patient.name}</span>
          <span className="text-[12px] text-gray-60 leading-none">
            {patient.time}  {patient.address}
          </span>
        </div>
        <IconChevronDown
          className={clsx(
            'size-5 shrink-0 text-gray-100 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="flex flex-col gap-[14px]">
          {/* Address row */}
          <div className="flex flex-col gap-[6px]">
            <span className="text-[12px] text-gray-60">Address</span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-bold text-gray-100">{patient.fullAddress}</span>
              <IconMapsFilled className="size-[20px] shrink-0 text-gray-100" />
            </div>
          </div>

          {/* Map preview */}
          <div
            className="relative h-[120px] overflow-hidden rounded-[12px]"
            style={
              mapImageUrl
                ? {
                    backgroundImage: `url('${mapImageUrl}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : {
                    background:
                      'radial-gradient(ellipse at 30% 40%, #DDE7F2 0%, #C9DBE9 60%, #A2B8CC 100%)',
                  }
            }
            aria-label="Patient address map"
          >
            <span className="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-primary/25" />
            <span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-100" />
          </div>

          {/* Emergency contacts */}
          <div className="flex flex-col gap-[10px]">
            <span className="text-[12px] text-gray-60">Emergency Contact</span>
            {patient.emergencyContacts.map((c) => (
              <div key={c.id} className="flex items-center gap-[10px]">
                <div className="flex flex-1 flex-col leading-tight">
                  <span className="text-[14px] font-bold text-gray-100">{c.name}</span>
                  <span className="text-[12px] text-gray-60">
                    {c.relation}  {c.phone}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={`Call ${c.name}`}
                  className="flex size-[34px] items-center justify-center rounded-full bg-brand-border transition-colors active:bg-brand-tint-1"
                >
                  <IconHandphone className="size-[16px] text-brand-primary" />
                </button>
                <button
                  type="button"
                  aria-label={`Message ${c.name}`}
                  className="flex size-[34px] items-center justify-center rounded-full bg-brand-border transition-colors active:bg-brand-tint-1"
                >
                  <IconChat className="size-[16px] text-brand-primary" />
                </button>
              </div>
            ))}
          </div>

          {/* Arrival CTA */}
          <button
            type="button"
            onClick={() => setArrived((a) => !a)}
            aria-pressed={arrived}
            className={clsx(
              'mt-[4px] flex h-[44px] w-full items-center justify-center gap-[8px] rounded-full text-[14px] font-bold transition-colors',
              arrived
                ? 'bg-brand-accent/20 text-brand-accent'
                : 'bg-brand-primary text-white active:bg-brand-primary/85',
            )}
          >
            {arrived && <IconChecklistCircleFilled className="size-[18px]" />}
            {arrived ? "Arrived" : "I'm Arrived"}
          </button>
        </div>
      )}
    </div>
  );
}
