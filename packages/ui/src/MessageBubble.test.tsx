import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import type { ThreadMessage } from './messaging/types';

afterEach(cleanup);

const tagged: ThreadMessage = {
  id: 'm1',
  threadId: 'caregiver-001__erin-yeung',
  senderId: 'janet-chen',
  recipientId: 'caregiver-001',
  senderName: 'Janet Chen',
  text: 'Pick up prescription, order 4471',
  reportId: null,
  finalTier: 'action',
  acknowledgedAt: null,
  createdAt: '2026-09-15T09:00:00Z',
};

describe('MessageBubble', () => {
  it('gives the recipient a Confirm button that reports the message id', () => {
    const onConfirm = vi.fn();
    render(<MessageBubble message={tagged} viewerId="caregiver-001" onConfirm={onConfirm} />);
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.queryByText('Confirmed')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledWith('m1');
  });

  it('shows the sender Pending, with no Confirm button', () => {
    render(<MessageBubble message={tagged} viewerId="janet-chen" />);
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.queryByText('Confirmed')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
  });

  it('shows both sides Confirmed once acknowledged, with no lingering Pending', () => {
    const done = { ...tagged, acknowledgedAt: '2026-09-15T10:00:00Z' };
    render(<MessageBubble message={done} viewerId="caregiver-001" onConfirm={() => {}} />);
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.queryByText('Pending')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    cleanup();
    render(<MessageBubble message={done} viewerId="janet-chen" />);
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.queryByText('Pending')).toBeNull();
  });

  it('renders an untagged message as a plain bubble', () => {
    render(<MessageBubble message={{ ...tagged, finalTier: null }} viewerId="caregiver-001" />);
    expect(screen.getByText('Pick up prescription, order 4471')).toBeTruthy();
    expect(screen.queryByText('Pending')).toBeNull();
  });

  it('marks its root with the message id for jump-to-message', () => {
    const { container } = render(<MessageBubble message={tagged} viewerId="caregiver-001" />);
    expect(container.querySelector('[data-message-id="m1"]')).not.toBeNull();
  });

  /*
   * The action sheet renders this component into a wrapper already sized to
   * the pressed bubble's measured width, so `max-w-[75%]` there means 75% of
   * the bubble itself: the text reflowed narrower and the copy grew taller
   * the instant you pressed it, which read as the message shrinking and
   * moving. jsdom does no layout, so the cap is pinned by class instead.
   */
  it('fills its wrapper when lifted, and is capped at 75% of the row when not', () => {
    const { container } = render(<MessageBubble message={tagged} viewerId="caregiver-001" lifted />);
    const lifted = container.querySelector('[data-message-id="m1"]')?.firstElementChild;
    expect(lifted?.className).toContain('w-full');
    expect(lifted?.className).not.toContain('max-w-[75%]');
    cleanup();
    const plain = render(<MessageBubble message={tagged} viewerId="caregiver-001" />);
    const bubble = plain.container.querySelector('[data-message-id="m1"]')?.firstElementChild;
    expect(bubble?.className).toContain('max-w-[75%]');
  });
});
