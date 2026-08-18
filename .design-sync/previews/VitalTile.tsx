import { VitalTile, IconHeartRate, IconBloodPressure, IconBloodBag, IconPills } from '@alio/ui';

/** Tiles inside Today's Status on Family Home — real SAMPLE_VITALS readings. */
const Grid = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      width: 300,
      padding: 12,
      background: 'var(--color-brand-tint-2)',
    }}
  >
    {children}
  </div>
);

export const VitalsGrid = () => (
  <Grid>
    <VitalTile label="Blood Count" value="80-90" Icon={IconBloodBag} />
    <VitalTile label="Blood Stutas" value="116/70" Icon={IconBloodPressure} />
    <VitalTile label="Heart Rate" value="120 bpm" Icon={IconHeartRate} />
    <VitalTile label="Pressure" value="Normal" Icon={IconPills} />
  </Grid>
);

export const SingleTile = () => (
  <div style={{ padding: 12, background: 'var(--color-brand-tint-2)', width: 160 }}>
    <VitalTile label="Heart Rate" value="120 bpm" Icon={IconHeartRate} />
  </div>
);

export const WithoutIcon = () => (
  <div style={{ padding: 12, background: 'var(--color-brand-tint-2)', width: 160 }}>
    <VitalTile label="Pressure" value="Normal" />
  </div>
);
