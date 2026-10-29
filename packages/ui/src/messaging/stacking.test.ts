import { describe, expect, it } from 'vitest';
import { STACK_WINDOW_MS, endsStack, messageStatus } from './stacking';
import type { ThreadMessage } from './types';

const base: ThreadMessage = {
  id: 'm1',
  threadId: 't1',
  senderId: 'janet-chen',
  recipientId: 'caregiver-001',
  senderName: 'Janet Chen',
  text: 'Please pick up her prescription.',
  finalTier: null,
  reportId: null,
  acknowledgedAt: null,
  createdAt: '2026-09-17T10:00:00Z',
};

function at(iso: string, over: Partial<ThreadMessage> = {}): ThreadMessage {
  return { ...base, id: iso, createdAt: iso, ...over };
}

describe('endsStack', () => {
  it('ends the stack at the last message', () => {
    expect(endsStack(base, undefined)).toBe(true);
  });

  it('keeps a quick follow-up from the same person in the same stack', () => {
    expect(endsStack(at('2026-09-17T10:00:00Z'), at('2026-09-17T10:00:20Z'))).toBe(false);
  });

  it('ends the stack when the next message is from someone else', () => {
    const next = at('2026-09-17T10:00:05Z', { senderId: 'caregiver-001' });
    expect(endsStack(at('2026-09-17T10:00:00Z'), next)).toBe(true);
  });

  it('ends the stack when the next message is a separate turn', () => {
    expect(endsStack(at('2026-09-17T10:00:00Z'), at('2026-09-17T10:30:00Z'))).toBe(true);
  });

  // Exactly at the window is a new turn, so the boundary has one answer
  // rather than depending on millisecond noise.
  it('treats the window itself as a new turn', () => {
    const start = new Date('2026-09-17T10:00:00Z');
    const edge = new Date(start.getTime() + STACK_WINDOW_MS).toISOString();
    const inside = new Date(start.getTime() + STACK_WINDOW_MS - 1).toISOString();
    expect(endsStack(at(start.toISOString()), at(edge))).toBe(true);
    expect(endsStack(at(start.toISOString()), at(inside))).toBe(false);
  });

  /*
   * Messages arrive from Postgres in mixed offsets, and a naive string
   * comparison would call these 60 minutes apart when they are 20 seconds
   * apart. Same trap the ordering tests pin.
   */
  it('compares instants, not the strings they are written in', () => {
    const a = at('2026-09-17T20:00:00+12:00');
    const b = at('2026-09-17T08:00:20Z');
    expect(endsStack(a, b)).toBe(false);
  });

  // An unparseable date must not swallow a message's state.
  it('ends the stack rather than hiding a status line it cannot place', () => {
    expect(endsStack(at('not-a-date'), at('2026-09-17T10:00:10Z'))).toBe(true);
    expect(endsStack(at('2026-09-17T10:00:00Z'), at('not-a-date'))).toBe(true);
  });
});

describe('messageStatus', () => {
  it('calls an untagged message of your own Sent', () => {
    expect(messageStatus(base, 'janet-chen')).toBe('sent');
  });

  it('gives a message you received no word at all, only its time', () => {
    expect(messageStatus(base, 'caregiver-001')).toBe('none');
  });

  it('reads the same on both sides once it is marked', () => {
    const marked = { ...base, finalTier: 'action' as const };
    expect(messageStatus(marked, 'janet-chen')).toBe('pending');
    expect(messageStatus(marked, 'caregiver-001')).toBe('pending');
  });

  it('reads Confirmed on both sides once acknowledged', () => {
    const done = { ...base, finalTier: 'action' as const, acknowledgedAt: '2026-09-17T10:05:00Z' };
    expect(messageStatus(done, 'janet-chen')).toBe('confirmed');
    expect(messageStatus(done, 'caregiver-001')).toBe('confirmed');
  });

  // An acknowledgement on an untagged row is the corrupt state the merge
  // guard exists to prevent; if one ever reaches a screen it must not claim
  // to be confirmed.
  it('does not call an untagged message confirmed', () => {
    const odd = { ...base, acknowledgedAt: '2026-09-17T10:05:00Z' };
    expect(messageStatus(odd, 'janet-chen')).toBe('sent');
  });
});
