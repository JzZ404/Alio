import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MessageActionSheet } from './MessageActionSheet';
import type { ThreadMessage } from './messaging/types';

afterEach(cleanup);

const mine: ThreadMessage = {
  id: 'm1',
  threadId: 'caregiver-001__erin-yeung',
  senderId: 'janet-chen',
  recipientId: 'caregiver-001',
  senderName: 'Janet Chen',
  text: 'Please pick up her prescription on your way today — order 4471.',
  reportId: null,
  finalTier: null,
  acknowledgedAt: null,
  createdAt: '2026-09-16T09:00:00Z',
};

describe('MessageActionSheet', () => {
  it('renders nothing when no message is held', () => {
    const { container } = render(
      <MessageActionSheet message={null} onMarkPending={() => {}} onCopy={() => {}} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('offers the three actions, with the message and the reassurance', () => {
    render(
      <MessageActionSheet message={mine} onMarkPending={() => {}} onCopy={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText(mine.text)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark as Pending' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reply' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy text' })).toBeTruthy();
    expect(screen.getByText('Sarah Confirms it when she sees it')).toBeTruthy();
  });

  it('reports the action taken and closes on the backdrop', () => {
    const onMarkPending = vi.fn();
    const onCopy = vi.fn();
    const onClose = vi.fn();
    render(
      <MessageActionSheet message={mine} onMarkPending={onMarkPending} onCopy={onCopy} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Pending' }));
    expect(onMarkPending).toHaveBeenCalledWith(mine);
    fireEvent.click(screen.getByRole('button', { name: 'Copy text' }));
    expect(onCopy).toHaveBeenCalledWith(mine);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('hides Mark as Pending once the message is already marked', () => {
    render(
      <MessageActionSheet
        message={{ ...mine, finalTier: 'action' }}
        onMarkPending={() => {}}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Mark as Pending' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy text' })).toBeTruthy();
  });
});
