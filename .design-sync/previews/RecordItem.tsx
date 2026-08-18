import { RecordItem } from '@alio/ui';

/**
 * RecordItem is one row in the Family Records list. The icon is chosen from the
 * record type; content is the real SAMPLE_RECORDS fixture.
 */
const List = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 340, padding: 12 }}>
    {children}
  </div>
);

export const AllTypes = () => (
  <List>
    <RecordItem record={{ id: 'r1', title: 'Cardiology Follow-up', type: 'Lab report', date: 'May 02, 2026' }} />
    <RecordItem record={{ id: 'r2', title: 'Metformin 150mg', type: 'Prescription', date: 'May 01, 2026' }} />
    <RecordItem record={{ id: 'r3', title: 'Physical Therapy Plan', type: 'Other', date: 'Mar 03, 2026' }} />
  </List>
);

export const SingleRecord = () => (
  <List>
    <RecordItem record={{ id: 'r4', title: 'HbA1c Test', type: 'Lab report', date: 'May 02, 2026' }} />
  </List>
);
