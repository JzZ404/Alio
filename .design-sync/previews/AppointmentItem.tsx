import { AppointmentItem } from '@alio/ui';

/** Rows from the Family Home "Upcoming" list — real SAMPLE_APPOINTMENTS content. */
const List = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 320, padding: 12 }}>
    {children}
  </div>
);

export const Upcoming = () => (
  <List>
    <AppointmentItem
      appt={{ id: 'a1', month: 'May', day: 20, title: 'Primary Care Checkup', provider: 'Dr. Rowan', time: '10:30 AM' }}
    />
    <AppointmentItem
      appt={{ id: 'a2', month: 'Jun', day: 3, title: 'Cardiology Follow-up', provider: 'Dr. Alvarez', time: '2:00 PM' }}
    />
    <AppointmentItem
      appt={{ id: 'a3', month: 'Jun', day: 12, title: 'Physical Therapy', provider: 'Westside Clinic', time: '9:15 AM' }}
    />
  </List>
);

export const SingleRow = () => (
  <List>
    <AppointmentItem
      appt={{ id: 'a1', month: 'May', day: 20, title: 'Primary Care Checkup', provider: 'Dr. Rowan', time: '10:30 AM' }}
    />
  </List>
);
