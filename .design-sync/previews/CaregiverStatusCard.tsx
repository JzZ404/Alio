import { CaregiverStatusCard } from '@alio/ui';

/**
 * CaregiverStatusCard is the live visit tracker at the top of Family Home. The
 * headline and step tracker follow `status`; expanding reveals the map and
 * visit detail. Caregiver content is the real SAMPLE_CAREGIVER fixture.
 */
const avatar = (bg: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${bg}"/><circle cx="32" cy="25" r="12" fill="#9E9E9E"/><path d="M6 64c0-14 12-21 26-21s26 7 26 21z" fill="#9E9E9E"/></svg>`,
  );

const SARAH = { id: 'caregiver-001', name: 'Sarah Mitchell', visits: 128 };

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 360, padding: 12, background: 'var(--color-brand-tint-2)' }}>{children}</div>
);

export const OnTheWay = () => (
  <Stage>
    <CaregiverStatusCard caregiver={SARAH} status="on-the-way" avatarUrl={avatar('#EDEDFC')} />
  </Stage>
);

export const Arrived = () => (
  <Stage>
    <CaregiverStatusCard caregiver={SARAH} status="arrived" avatarUrl={avatar('#EDEDFC')} />
  </Stage>
);

export const VisitComplete = () => (
  <Stage>
    <CaregiverStatusCard caregiver={SARAH} status="complete" avatarUrl={avatar('#EDEDFC')} />
  </Stage>
);
