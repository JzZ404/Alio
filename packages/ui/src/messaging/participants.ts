/**
 * Prototype identities. There is no auth (ARCHITECTURE.md → Identity): each app
 * is signed in as exactly one person, and the only live thread is the
 * Sarah ↔ Janet dyad about Erin. Replace with the session user when auth lands.
 */
export const CAREGIVER_ID = 'caregiver-001';
export const FAMILY_MEMBER_ID = 'janet-chen';

export const CARE_THREAD_ID = 'caregiver-001__erin-yeung';

export const DISPLAY_NAME: Record<string, string> = {
  [CAREGIVER_ID]: 'Sarah Lee',
  [FAMILY_MEMBER_ID]: 'Janet Chen',
};

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
