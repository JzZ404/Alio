import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ReplyComposer } from './ReplyComposer';
import { Toast } from './Toast';
import type { ThreadMessage } from './messaging/types';

const theirs: ThreadMessage = {
  id: 'm1',
  threadId: 't1',
  senderId: 'caregiver-001',
  recipientId: 'janet-chen',
  senderName: 'Sarah Lee',
  text: "Morning! I'm with your mom now — she slept well and had breakfast.",
  finalTier: null,
  reportId: null,
  acknowledgedAt: null,
  createdAt: '2026-09-17T09:00:00Z',
};
const mine: ThreadMessage = { ...theirs, id: 'm2', senderId: 'janet-chen', recipientId: 'caregiver-001' };

function setup(replyingTo: ThreadMessage, props: Partial<Parameters<typeof ReplyComposer>[0]> = {}) {
  return render(
    <ReplyComposer
      replyingTo={replyingTo}
      viewerId="janet-chen"
      value=""
      onChange={() => {}}
      onSend={() => {}}
      onCancel={() => {}}
      {...props}
    />,
  );
}

afterEach(cleanup);

describe('ReplyComposer', () => {
  it('names who is being answered, and says "you" for the viewer\'s own message', () => {
    setup(mine);
    expect(screen.getByText('Replying to you')).toBeTruthy();
    cleanup();
    setup(theirs);
    expect(screen.getByText('Replying to Sarah Lee')).toBeTruthy();
  });

  it('quotes the message being answered', () => {
    setup(theirs);
    expect(screen.getByText(theirs.text)).toBeTruthy();
  });

  // The whole point of tapping Reply is to start typing; on a phone an
  // unfocused input means no keyboard and a composer that looks ready but
  // is not.
  it('focuses its input so the reply can be typed straight away', () => {
    setup(theirs);
    expect(document.activeElement).toBe(screen.getByLabelText('Reply'));
  });

  it('sends on Enter and on the send button, but not while an IME is composing', () => {
    const onSend = vi.fn();
    setup(theirs, { value: 'The one on Grove, right', onSend });
    const input = screen.getByLabelText('Reply');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
    expect(onSend).toHaveBeenCalledTimes(2);
  });

  it('can be backed out of', () => {
    const onCancel = vi.fn();
    setup(theirs, { onCancel });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel reply' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('Toast', () => {
  // status, not alert: a copy confirmation should wait its turn rather than
  // cut off whatever a screen reader is already saying.
  it('announces politely', () => {
    render(<Toast message="Text Copied." />);
    expect(screen.getByRole('status').textContent).toBe('Text Copied.');
  });
});
