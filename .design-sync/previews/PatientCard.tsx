import { PatientCard } from '@alio/ui';

/**
 * PatientCard is a row in the Caregiver Home schedule. Collapsed shows the
 * visit; expanded adds the full address, a map preview, and emergency contacts.
 *
 * Avatars are inline data URIs — the apps serve real photos from /public.
 */
const avatar = (bg: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${bg}"/><circle cx="32" cy="25" r="12" fill="#9E9E9E"/><path d="M6 64c0-14 12-21 26-21s26 7 26 21z" fill="#9E9E9E"/></svg>`,
  );

const DOROTHY = {
  id: 'dorothy-chen',
  name: 'Dorothy Chen',
  time: '10:00 AM',
  address: '1234 Maple St',
  fullAddress: '1234 Maple St, Portland, OR',
  avatarUrl: avatar('#EDEDFC'),
  emergencyContacts: [
    { id: 'c1', name: 'Janet Chen', relation: 'Daughter', phone: '(503) 555-0192' },
    { id: 'c2', name: 'Robert Chen', relation: 'Son', phone: '(503) 555-0192' },
  ],
};

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 340, padding: 12, background: 'var(--color-brand-tint-2)' }}>{children}</div>
);

export const Collapsed = () => (
  <Stage>
    <PatientCard patient={DOROTHY} />
  </Stage>
);

export const Expanded = () => (
  <Stage>
    <PatientCard patient={DOROTHY} defaultExpanded />
  </Stage>
);
