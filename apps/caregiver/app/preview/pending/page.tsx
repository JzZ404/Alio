'use client';

/**
 * TEMPORARY design-review surface for the Pending Confirmations work
 * (docs/superpowers/specs/2026-09-15-pending-confirmations-design.md).
 * Lets the team look at every MessageBubble / NeedsResponseToggle state
 * before Tasks 5-8 build real screens on top of them. No routing links to
 * this page and no props — it is expected to be deleted before merge.
 */

import { useState } from 'react';
import {
  CAREGIVER_ID,
  FAMILY_MEMBER_ID,
  MessageBubble,
  NeedsResponseToggle,
  type ThreadMessage,
} from '@alio/ui';

const THREAD_ID = 'caregiver-001__erin-yeung';

export default function PendingConfirmationsPreviewPage() {
  // Case 1 + 2 share this message: tapping Confirm in the caregiver's view
  // (case 1) flips it, and the family view (case 2) updates too, since both
  // sides read the same underlying message.
  const [pendingMessage, setPendingMessage] = useState<ThreadMessage>({
    id: 'preview-pending',
    threadId: THREAD_ID,
    senderId: FAMILY_MEMBER_ID,
    recipientId: CAREGIVER_ID,
    senderName: 'Janet Chen',
    text: 'Pick up prescription, order 4471',
    reportId: null,
    finalTier: 'action',
    acknowledgedAt: null,
    createdAt: '2026-09-15T09:00:00Z',
  });

  const confirmedMessage: ThreadMessage = {
    id: 'preview-confirmed',
    threadId: THREAD_ID,
    senderId: FAMILY_MEMBER_ID,
    recipientId: CAREGIVER_ID,
    senderName: 'Janet Chen',
    text: 'Pick up prescription, order 4471',
    reportId: null,
    finalTier: 'action',
    acknowledgedAt: '2026-09-15T10:00:00Z',
    createdAt: '2026-09-15T09:00:00Z',
  };

  const plainTheirs: ThreadMessage = {
    id: 'preview-plain-theirs',
    threadId: THREAD_ID,
    senderId: FAMILY_MEMBER_ID,
    recipientId: CAREGIVER_ID,
    senderName: 'Janet Chen',
    text: 'On my way — about 20 minutes',
    reportId: null,
    finalTier: null,
    acknowledgedAt: null,
    createdAt: '2026-09-15T09:05:00Z',
  };

  const plainMine: ThreadMessage = {
    id: 'preview-plain-mine',
    threadId: THREAD_ID,
    senderId: CAREGIVER_ID,
    recipientId: FAMILY_MEMBER_ID,
    senderName: 'Sarah Lee',
    text: 'On my way — about 20 minutes',
    reportId: null,
    finalTier: null,
    acknowledgedAt: null,
    createdAt: '2026-09-15T09:06:00Z',
  };

  const [highlightedMessage, setHighlightedMessage] = useState<ThreadMessage>({
    id: 'preview-highlighted',
    threadId: THREAD_ID,
    senderId: FAMILY_MEMBER_ID,
    recipientId: CAREGIVER_ID,
    senderName: 'Janet Chen',
    text: 'Can you refill the pill organizer?',
    reportId: null,
    finalTier: 'action',
    acknowledgedAt: null,
    createdAt: '2026-09-15T08:15:00Z',
  });

  const [needsResponsePressed, setNeedsResponsePressed] = useState(false);

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: 'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      <div className="mx-auto flex w-[390px] max-w-full flex-col gap-8 px-4 py-10">
        <h1 className="text-lg font-bold text-gray-100">Pending Confirmations — preview</h1>

        <Case caption="Caregiver's view — needs response, not yet confirmed">
          <MessageBubble
            message={pendingMessage}
            viewerId={CAREGIVER_ID}
            onConfirm={(messageId) =>
              setPendingMessage((prev) =>
                prev.id === messageId ? { ...prev, acknowledgedAt: '2026-09-15T09:30:00Z' } : prev,
              )
            }
          />
        </Case>

        <Case caption="Family's view — the same message they sent, still waiting">
          <MessageBubble message={pendingMessage} viewerId={FAMILY_MEMBER_ID} />
        </Case>

        <Case caption="Caregiver's view — confirmed">
          <MessageBubble message={confirmedMessage} viewerId={CAREGIVER_ID} onConfirm={() => {}} />
        </Case>

        <Case caption="Family's view — confirmed">
          <MessageBubble message={confirmedMessage} viewerId={FAMILY_MEMBER_ID} />
        </Case>

        <Case caption="Plain message, theirs">
          <MessageBubble message={plainTheirs} viewerId={CAREGIVER_ID} />
        </Case>

        <Case caption="Plain message, mine">
          <MessageBubble message={plainMine} viewerId={CAREGIVER_ID} />
        </Case>

        <Case caption="Highlighted (jumped to from the Pending list)">
          <MessageBubble
            message={highlightedMessage}
            viewerId={CAREGIVER_ID}
            onConfirm={(messageId) =>
              setHighlightedMessage((prev) =>
                prev.id === messageId ? { ...prev, acknowledgedAt: '2026-09-15T08:45:00Z' } : prev,
              )
            }
            highlighted
          />
        </Case>

        <Case caption="Composer toggle">
          <div className="flex flex-col gap-2">
            <NeedsResponseToggle
              pressed={needsResponsePressed}
              onToggle={() => setNeedsResponsePressed((prev) => !prev)}
            />
            <p className="text-xs text-gray-60">
              {needsResponsePressed
                ? 'Needs response is ON — the next message will be tagged.'
                : 'Needs response is OFF — the next message sends as plain.'}
            </p>
          </div>
        </Case>
      </div>
    </div>
  );
}

function Case({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <p className="text-xs text-gray-60">{caption}</p>
      {children}
    </section>
  );
}
