import { TodayStatusCard } from '@alio/ui';

/**
 * TodayStatusCard is the purple hero card on Family Home: the day's headline,
 * medications, four vitals, and the last visit. Content is the real
 * SAMPLE_VITALS / SAMPLE_MEDICATIONS fixture set.
 */
const VITALS = [
  { id: 'v1', label: 'Blood Count', value: '80-90', iconHint: 'blood-count' as const },
  { id: 'v2', label: 'Blood Stutas', value: '116/70', iconHint: 'blood-status' as const },
  { id: 'v3', label: 'Heart Rate', value: '120 bpm', iconHint: 'heart-rate' as const },
  { id: 'v4', label: 'Pressure', value: 'Normal', iconHint: 'pressure' as const },
];

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 360, padding: 12, background: 'var(--color-brand-tint-2)' }}>{children}</div>
);

export const Default = () => (
  <Stage>
    <TodayStatusCard
      statusLine="Harold is stable today."
      medications={[{ id: 'm1', name: 'Metaformin', dose: '150mg' }]}
      vitals={VITALS}
      lastVisitBy="Sarah Mitchell"
      lastVisitTime="2:30 PM"
    />
  </Stage>
);

export const MultipleMedications = () => (
  <Stage>
    <TodayStatusCard
      statusLine="Dorothy had a quiet morning."
      medications={[
        { id: 'm1', name: 'Metaformin', dose: '150mg' },
        { id: 'm2', name: 'Lisinopril', dose: '10mg' },
      ]}
      vitals={VITALS}
      lastVisitBy="Sarah Mitchell"
      lastVisitTime="11:05 AM"
    />
  </Stage>
);
