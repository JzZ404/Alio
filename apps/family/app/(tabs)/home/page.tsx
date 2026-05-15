'use client';

import { useState } from 'react';
import {
  CaregiverStatusCard,
  TodayStatusCard,
  CalendarWidget,
  FloatingAddButton,
} from '@alio/ui';
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

  // Demo toggle: clicking the FAB cycles the caregiver status through the 4 states.
  const cycleStatus = () => {
    const order: CaregiverStatus[] = ['on-the-way', 'arrived', 'in-progress', 'complete'];
    setStatus(order[(order.indexOf(status) + 1) % order.length]);
  };

  return (
    <div
      className="h-full min-h-screen overflow-y-auto pb-32 sm:h-[852px] sm:min-h-0"
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

      {/* FAB — pinned to bottom right, above the tab bar */}
      <FloatingAddButton
        onClick={cycleStatus}
        aria-label="Cycle caregiver status (demo)"
        className="fixed bottom-[100px] right-5 sm:absolute"
      />
    </div>
  );
}
