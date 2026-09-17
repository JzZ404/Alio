import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MessageStatusLine } from './MessageStatusLine';
import { MessageBubble } from './MessageBubble';
import type { ThreadMessage } from './messaging/types';

const mine: ThreadMessage = {
  id: 'm1',
  threadId: 't1',
  senderId: 'janet-chen',
  recipientId: 'caregiver-001',
  senderName: 'Janet Chen',
  text: 'Please pick up her prescription on your way today.',
  finalTier: null,
  reportId: null,
  acknowledgedAt: null,
  createdAt: '2026-09-17T17:12:00Z',
};

afterEach(cleanup);

describe('MessageStatusLine', () => {
  it('says Sent for your own untagged message', () => {
    render(<MessageStatusLine message={mine} viewerId="janet-chen" />);
    expect(screen.getByText('Sent')).toBeTruthy();
  });

  // "Sent" is the sender's claim about their own message; on the receiving
  // side it would be meaningless, so the line is just a time.
  it('gives a received message a time and no word', () => {
    const { container } = render(<MessageStatusLine message={mine} viewerId="caregiver-001" />);
    expect(screen.queryByText('Sent')).toBeNull();
    expect(container.textContent).not.toContain('·');
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('says Pending while marked, and Confirmed once acknowledged', () => {
    const marked = { ...mine, finalTier: 'action' as const };
    render(<MessageStatusLine message={marked} viewerId="janet-chen" />);
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.queryByText('Confirmed')).toBeNull();
    cleanup();
    render(
      <MessageStatusLine
        message={{ ...marked, acknowledgedAt: '2026-09-17T18:02:00Z' }}
        viewerId="janet-chen"
      />,
    );
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.queryByText('Pending')).toBeNull();
  });
});

describe('MessageBubble with the status line', () => {
  /*
   * The old design tinted a marked bubble and put the word inside it on both
   * sides. Now the tint is an instruction, so it belongs only on the bubble
   * that carries a Confirm button — the sender's own copy is a plain bubble
   * with a status line under it.
   */
  it('leaves the sender their ordinary bubble and states the case underneath', () => {
    const marked = { ...mine, finalTier: 'action' as const };
    const { container } = render(<MessageBubble message={marked} viewerId="janet-chen" />);
    expect(container.querySelector('.bg-attention-surface')).toBeNull();
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('tints the copy the recipient has to act on', () => {
    const marked = { ...mine, finalTier: 'action' as const };
    const { container } = render(
      <MessageBubble message={marked} viewerId="caregiver-001" onConfirm={() => {}} />,
    );
    expect(container.querySelector('.bg-attention-surface')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy();
  });

  // Stacked messages share the last one's line; without this a burst of
  // three would print three timestamps.
  it('omits the line when it is not the last of a stack', () => {
    render(<MessageBubble message={mine} viewerId="janet-chen" showStatus={false} />);
    expect(screen.queryByText('Sent')).toBeNull();
  });
});
