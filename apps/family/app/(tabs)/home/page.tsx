'use client';

import { useState } from 'react';
import {
  CaregiverStatusCard,
  TodayStatusCard,
  CalendarWidget,
  FloatingAddButton,
  AddRecordModal,
} from '@alio/ui';
import { useRecords } from '@/lib/records-store';
import {
  SAMPLE_CAREGIVER,
  SAMPLE_VITALS,
  SAMPLE_MEDICATIONS,
  SAMPLE_APPOINTMENTS,
  SAMPLE_CALENDAR,
  type CaregiverStatus,
} from '@alio/mock-data';

export default function FamilyHomePage() {
  // Default to "on-the-way" — user can toggle to demonstrate the expanded state.
  // (A real flow would update this from a websocket / GPS event.)
  const [status, setStatus] = useState<CaregiverStatus>('on-the-way');
  const [addOpen, setAddOpen] = useState(false);
  const { addRecord } = useRecords();

  return (
    <div
      className="h-full overflow-y-auto pb-32"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      <div className="flex flex-col gap-3 px-4 pb-6 pt-12">
        <CaregiverStatusCard
          caregiver={SAMPLE_CAREGIVER}
          status={status}
          avatarUrl="/avatars/nurse.png"
          mapImageUrl="/map/map.png"
          /* Re-key so it re-mounts when status changes, picking up the new
           * default-expanded behavior (arrived → auto-expanded). */
          key={status}
        />

        <TodayStatusCard
          elderName="Erin"
          statusLine="Erin is stable today."
          medications={SAMPLE_MEDICATIONS}
          vitals={SAMPLE_VITALS}
          lastVisitBy={SAMPLE_CAREGIVER.name}
          lastVisitTime="2:30 PM"
        />

        <CalendarWidget month={SAMPLE_CALENDAR} appointments={SAMPLE_APPOINTMENTS} />
      </div>

      {/* FAB — pinned to bottom right, above the tab bar. Opens the same
       * Add Record sheet the Records tab uses, so the family can upload a lab
       * report or prescription without leaving Home. */}
      <FloatingAddButton
        onClick={() => setAddOpen(true)}
        aria-label="Add record"
        className="fixed bottom-[100px] right-5 sm:absolute"
      />

      <AddRecordModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={addRecord}
      />
    </div>
  );
}
