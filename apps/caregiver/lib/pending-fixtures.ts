import type { ThreadMessage } from '@alio/ui';
import { CAREGIVER_ID, CARE_THREAD_ID, PEOPLE } from '@alio/ui';

/**
 * Demo people for the caregiver screens. The live thread has exactly one family
 * member (Janet); these fixtures let the Pending and Confirmed screens show the
 * range of senders the design calls for. They follow the codebase's existing
 * pattern of mock history alongside live rows (see the chat pages), and they
 * are display-only — confirming one updates local state, never the database.
 */
const ago = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

function demo(
  id: string,
  senderId: string,
  text: string,
  createdAt: string,
  acknowledgedAt: string | null,
): ThreadMessage {
  return {
    id,
    threadId: CARE_THREAD_ID,
    senderId,
    recipientId: CAREGIVER_ID,
    senderName: PEOPLE[senderId].name,
    text,
    reportId: null,
    finalTier: 'action',
    acknowledgedAt,
    createdAt,
  };
}

function pendingFixtures(now: Date): ThreadMessage[] {
  return [
    demo(
      'demo-pending-emily',
      'emily-chen',
      "Could you check whether she still has enough of the blue blood pressure pills? I'll order more tonight if she's low.",
      ago(now, 40),
      null,
    ),
    demo(
      'demo-pending-charles',
      'charles-chen',
      "Mom's cardiology appointment moved to Thursday at 2:15. Can you take her then instead of Friday?",
      ago(now, 180),
      null,
    ),
  ];
}

function confirmedFixtures(now: Date): ThreadMessage[] {
  const day = 24 * 60;
  return [
    demo(
      'demo-confirmed-walker',
      'miranda-chen',
      'Can you bring the walker in from the porch before you leave?',
      ago(now, 300),
      ago(now, 240),
    ),
    demo(
      'demo-confirmed-grocery',
      'emily-chen',
      'Grocery list is on the fridge — she wants the oat milk this time.',
      ago(now, day + 400),
      ago(now, day + 300),
    ),
    demo(
      'demo-confirmed-water',
      'charles-chen',
      'Remind her to drink a full glass of water with lunch.',
      ago(now, day + 600),
      ago(now, day + 500),
    ),
    demo(
      'demo-confirmed-mail',
      'miranda-chen',
      'Bring the mail up on Tuesday, please.',
      ago(now, 4 * day),
      ago(now, 4 * day - 60),
    ),
  ];
}

/**
 * Confirmed demo ids, and when each was confirmed. Module-level on purpose.
 *
 * These used to live in `PendingScreen`'s own state, and the tab layout
 * unmounts that screen on Back while `ChatTab` remounts on every tab switch —
 * so confirming Emily, going Back and reopening Pending brought her straight
 * back, and the Inbox card never stopped counting her. A module-level store is
 * the right scope for demo fixture state: it lasts exactly one page load, which
 * is as long as a demo needs to hold together, and it can never reach Supabase.
 */
const confirmedAt = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;

/** Idempotent, so a double-tap cannot insert the same row twice. */
export function confirmDemoMessage(id: string, at: string): void {
  if (confirmedAt.has(id)) return;
  confirmedAt.set(id, at);
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribeDemoConfirmations(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function demoConfirmationsVersion(): number {
  return version;
}

/**
 * Generated once per page load rather than per mount: regenerating from a
 * fresh clock every time a screen mounts would slide the fixtures' timestamps,
 * so the Inbox card and the Pending screen would disagree about how long Emily
 * has been waiting.
 */
let generated: { pending: ThreadMessage[]; confirmed: ThreadMessage[] } | null = null;

function fixtures(): { pending: ThreadMessage[]; confirmed: ThreadMessage[] } {
  if (generated === null) {
    const now = new Date();
    generated = { pending: pendingFixtures(now), confirmed: confirmedFixtures(now) };
  }
  return generated;
}

/** Demo items still waiting, minus anything confirmed on screen this session. */
export function demoPending(): ThreadMessage[] {
  return fixtures().pending.filter((m) => !confirmedAt.has(m.id));
}

/** Demo history, plus whatever was confirmed on screen this session. */
export function demoConfirmed(): ThreadMessage[] {
  const justConfirmed = fixtures()
    .pending.filter((m) => confirmedAt.has(m.id))
    .map((m) => ({ ...m, acknowledgedAt: confirmedAt.get(m.id) ?? null }));
  return [...justConfirmed, ...fixtures().confirmed];
}
