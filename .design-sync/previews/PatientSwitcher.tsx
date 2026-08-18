import { PatientSwitcher } from '@alio/ui';

/**
 * PatientSwitcher is the top-left context switcher on Caregiver Logs and Family
 * AI Check. The list opens on tap (internal state), so the cards show the
 * resting state for two different patients.
 *
 * Avatars are inline data URIs — the apps serve real photos from /public, which
 * does not exist outside the Next apps.
 */
const avatar = (bg: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${bg}"/><circle cx="32" cy="25" r="12" fill="#9E9E9E"/><path d="M6 64c0-14 12-21 26-21s26 7 26 21z" fill="#9E9E9E"/></svg>`,
  );

const PATIENTS = [
  {
    id: 'dorothy-chen',
    name: 'Dorothy Chen',
    time: '10:00 AM',
    address: '1234 Maple St',
    fullAddress: '1234 Maple St, Portland, OR',
    avatarUrl: avatar('#EDEDFC'),
    emergencyContacts: [
      { id: 'c1', name: 'Janet Chen', relation: 'Daughter', phone: '(503) 555-0192' },
    ],
  },
  {
    id: 'harold-foster',
    name: 'Harold Foster',
    time: '4:00 PM',
    address: '890 Pine Blvd',
    fullAddress: '890 Pine Blvd, Portland, OR',
    avatarUrl: avatar('#EAEAF2'),
    emergencyContacts: [
      { id: 'c1', name: 'Mary Foster', relation: 'Wife', phone: '(503) 555-0145' },
    ],
  },
];

const Header = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', padding: 16, width: 300, background: 'var(--color-brand-tint-2)' }}>
    {children}
  </div>
);

export const ActivePatient = () => (
  <Header>
    <PatientSwitcher patients={PATIENTS} activeId="dorothy-chen" onChange={() => {}} />
  </Header>
);

export const OtherPatient = () => (
  <Header>
    <PatientSwitcher patients={PATIENTS} activeId="harold-foster" onChange={() => {}} />
  </Header>
);
