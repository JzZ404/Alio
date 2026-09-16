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

export function DEMO_PENDING(now: Date): ThreadMessage[] {
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

export function DEMO_CONFIRMED(now: Date): ThreadMessage[] {
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
