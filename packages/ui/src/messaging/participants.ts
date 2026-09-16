/**
 * Prototype identities. There is no auth (ARCHITECTURE.md → Identity): each app
 * is signed in as exactly one person, and the only live thread is the
 * Sarah ↔ Janet dyad about Erin. Replace with the session user when auth lands.
 */
export const CAREGIVER_ID = 'caregiver-001';
export const FAMILY_MEMBER_ID = 'janet-chen';

export const CARE_THREAD_ID = 'caregiver-001__erin-yeung';

/**
 * Prototype directory. Relationship is what the caregiver screens show beside a
 * name ("Emily · Granddaughter"); it has no home in the database yet, so it
 * lives here until a people table exists.
 */
export const PEOPLE: Record<string, { name: string; relationship: string }> = {
  [CAREGIVER_ID]: { name: 'Sarah Lee', relationship: 'Caregiver' },
  [FAMILY_MEMBER_ID]: { name: 'Janet Chen', relationship: 'Daughter' },
  'emily-chen': { name: 'Emily', relationship: 'Granddaughter' },
  'charles-chen': { name: 'Charles', relationship: 'Son' },
  'miranda-chen': { name: 'Miranda', relationship: 'Daughter' },
};

export const DISPLAY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(PEOPLE).map(([id, person]) => [id, person.name]),
);

/** "Emily · Granddaughter" for a known sender, the plain name otherwise. */
export function personLabel(senderId: string | null, fallbackName: string): string {
  const person = senderId === null ? undefined : PEOPLE[senderId];
  return person ? `${person.name} · ${person.relationship}` : fallbackName;
}

/** Caregiver app chat-list thread id → Supabase thread_id. */
export const SUPABASE_THREAD_FOR_CAREGIVER: Record<string, string | undefined> = {
  'janet-chen': CARE_THREAD_ID,
};

/** Family app chat-list thread id → Supabase thread_id. */
export const SUPABASE_THREAD_FOR_FAMILY: Record<string, string | undefined> = {
  'sarah-caregiver': CARE_THREAD_ID,
};

/** Supabase thread_id → caregiver app chat-list thread id, for jump-to-message. */
export const CAREGIVER_THREAD_FOR_SUPABASE: Record<string, string | undefined> = {
  [CARE_THREAD_ID]: 'janet-chen',
};

/** In a dyad, whoever isn't the sender is the recipient. */
export function otherParticipant(userId: string): string {
  return userId === CAREGIVER_ID ? FAMILY_MEMBER_ID : CAREGIVER_ID;
}
