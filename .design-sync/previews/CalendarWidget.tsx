import { CalendarWidget } from '@alio/ui';

/**
 * CalendarWidget is the week strip + Upcoming list on Family Home. Month and
 * appointments come from the real SAMPLE_CALENDAR / SAMPLE_APPOINTMENTS
 * fixtures — days holding an appointment get a marker in the strip.
 */
const MONTH = { monthLabel: 'May 2026', year: 2026, month: 4, todayDay: 18, selectedDay: 24 };

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 360, padding: 12 }}>{children}</div>
);

export const WithAppointments = () => (
  <Stage>
    <CalendarWidget
      month={MONTH}
      appointments={[
        { id: 'a1', month: 'May', day: 20, title: 'Primary Care Checkup', provider: 'Dr. Rowan', time: '10:30 AM' },
        { id: 'a2', month: 'May', day: 22, title: 'Physical Therapy', provider: 'Westside Clinic', time: '9:15 AM' },
      ]}
    />
  </Stage>
);

export const NoAppointments = () => (
  <Stage>
    <CalendarWidget month={MONTH} />
  </Stage>
);
