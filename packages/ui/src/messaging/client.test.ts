import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { acknowledgeMessage, sendMessage } from './client';

/**
 * Records every builder call and resolves the chain with `result`, mirroring
 * how supabase-js query builders are awaited.
 */
function fakeClient(result: { data?: unknown; error?: { message: string } | null }) {
  const calls: Array<[string, unknown[]]> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) =>
            resolve({ data: result.data ?? null, error: result.error ?? null });
        }
        return (...args: unknown[]) => {
          calls.push([prop, args]);
          return builder;
        };
      },
    },
  );
  return { client: builder as SupabaseClient, calls };
}

const argsOf = (calls: Array<[string, unknown[]]>, name: string) =>
  calls.find(([n]) => n === name)?.[1];

describe('sendMessage', () => {
  it('writes an untagged message addressed to the other participant', async () => {
    const { client, calls } = fakeClient({ data: { id: 'row-1' } });
    const row = await sendMessage(client, {
      threadId: 'caregiver-001__erin-yeung',
      senderId: 'caregiver-001',
      text: 'On my way',
      needsResponse: false,
    });
    expect(row).toEqual({ id: 'row-1' });
    expect(argsOf(calls, 'from')).toEqual(['family_messages']);
    expect(argsOf(calls, 'insert')).toEqual([
      {
        thread_id: 'caregiver-001__erin-yeung',
        sender: 'Sarah Lee',
        sender_id: 'caregiver-001',
        recipient_id: 'janet-chen',
        text: 'On my way',
        final_tier: null,
        tagged_by: null,
      },
    ]);
  });

  it('tags Needs response as a manual sender tag', async () => {
    const { client, calls } = fakeClient({ data: { id: 'row-2' } });
    await sendMessage(client, {
      threadId: 'caregiver-001__erin-yeung',
      senderId: 'janet-chen',
      text: 'Pick up prescription, order 4471',
      needsResponse: true,
    });
    expect(argsOf(calls, 'insert')).toEqual([
      expect.objectContaining({
        sender: 'Janet Chen',
        recipient_id: 'caregiver-001',
        final_tier: 'action',
        tagged_by: 'sender_manual',
      }),
    ]);
  });

  it('throws when Supabase rejects the write', async () => {
    const { client } = fakeClient({ error: { message: 'network down' } });
    await expect(
      sendMessage(client, { threadId: 't', senderId: 'janet-chen', text: 'x', needsResponse: false }),
    ).rejects.toThrow('sendMessage: network down');
  });
});

describe('acknowledgeMessage', () => {
  it('sets both columns, only on a still-unconfirmed row', async () => {
    const { client, calls } = fakeClient({});
    await acknowledgeMessage(client, {
      messageId: 'row-2',
      userId: 'caregiver-001',
      at: new Date('2026-09-15T12:00:00Z'),
    });
    expect(argsOf(calls, 'update')).toEqual([
      { acknowledged_at: '2026-09-15T12:00:00.000Z', acknowledged_by: 'caregiver-001' },
    ]);
    expect(argsOf(calls, 'eq')).toEqual(['id', 'row-2']);
    expect(argsOf(calls, 'is')).toEqual(['acknowledged_at', null]);
  });

  it('throws when Supabase rejects the write', async () => {
    const { client } = fakeClient({ error: { message: 'denied' } });
    await expect(
      acknowledgeMessage(client, { messageId: 'row-2', userId: 'caregiver-001' }),
    ).rejects.toThrow('acknowledgeMessage: denied');
  });
});
