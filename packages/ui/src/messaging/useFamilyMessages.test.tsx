import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useFamilyMessages } from './useFamilyMessages';
import type { FamilyMessageRow } from './types';

afterEach(cleanup);

const CAREGIVER = 'caregiver-001';
const THREAD = 'caregiver-001__erin-yeung';

function row(overrides: Partial<FamilyMessageRow> = {}): FamilyMessageRow {
  return {
    id: 'row-1',
    thread_id: THREAD,
    sender: 'Janet Chen',
    sender_id: 'janet-chen',
    recipient_id: CAREGIVER,
    text: 'Pick up prescription, order 4471',
    report_id: null,
    final_tier: null,
    tagged_by: null,
    suggested_tier: null,
    suggested_by: null,
    acknowledged_at: null,
    acknowledged_by: null,
    followup_sent_at: null,
    created_at: '2026-09-15T09:00:00Z',
    ...overrides,
  };
}

/**
 * A Supabase client with the realtime side under the test's control: the
 * channel's status callback and its postgres_changes handlers are handed back
 * rather than fired, because *when* each one runs relative to the initial
 * select is the whole subject of these tests.
 *
 * `selectCount` is what proves the load is gated on SUBSCRIBED — the defect it
 * guards against (a write landing in the gap between snapshot and subscription)
 * is invisible in any test that lets the two happen together.
 */
function fakeClient(snapshot: { data?: FamilyMessageRow[]; error?: { message: string } }) {
  const state = {
    selectCount: 0,
    removed: 0,
    status: null as ((s: string, e?: Error) => void) | null,
    handlers: {} as Record<string, (payload: { new: FamilyMessageRow }) => void>,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) =>
            resolve({ data: snapshot.data ?? null, error: snapshot.error ?? null });
        }
        return () => builder;
      },
    },
  );

  const channel = {
    on(_event: string, opts: { event: string }, handler: (p: { new: FamilyMessageRow }) => void) {
      state.handlers[opts.event] = handler;
      return channel;
    },
    subscribe(callback: (s: string, e?: Error) => void) {
      state.status = callback;
      return channel;
    },
  };

  const client = {
    from: () => ({
      select: () => {
        state.selectCount += 1;
        return builder;
      },
    }),
    channel: () => channel,
    removeChannel: () => {
      state.removed += 1;
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

const scope = { by: 'thread', threadId: THREAD } as const;

describe('useFamilyMessages', () => {
  let logged: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logged.mockRestore();
  });

  it('does not load until the channel reports SUBSCRIBED', async () => {
    const { client, state } = fakeClient({ data: [row()] });
    const { result } = renderHook(() => useFamilyMessages(client, scope));

    expect(state.selectCount).toBe(0);
    expect(result.current.messages).toEqual([]);

    await act(async () => state.status?.('SUBSCRIBED'));

    expect(state.selectCount).toBe(1);
    expect(result.current.messages.map((m) => m.id)).toEqual(['row-1']);
    expect(result.current.error).toBe(false);
  });

  it('reports and logs a channel that never goes live', async () => {
    const { client, state } = fakeClient({ data: [row()] });
    const { result } = renderHook(() => useFamilyMessages(client, scope));

    await act(async () => state.status?.('CHANNEL_ERROR', new Error('websocket refused')));

    expect(result.current.error).toBe(true);
    expect(state.selectCount).toBe(0);
    expect(logged).toHaveBeenCalled();
  });

  it('reports a failed initial select rather than an empty thread', async () => {
    const { client, state } = fakeClient({ error: { message: 'permission denied' } });
    const { result } = renderHook(() => useFamilyMessages(client, scope));

    await act(async () => state.status?.('SUBSCRIBED'));

    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBe(true);
    expect(logged).toHaveBeenCalled();
  });

  it('stays quiet when the channel closes on unmount', async () => {
    const { client, state } = fakeClient({ data: [row()] });
    const { unmount } = renderHook(() => useFamilyMessages(client, scope));

    unmount();
    await act(async () => state.status?.('CLOSED'));

    expect(state.removed).toBe(1);
    expect(logged).not.toHaveBeenCalled();
  });

  it('does not let a stale snapshot undo an UPDATE that arrived first', async () => {
    // The snapshot was read before the mark and the Confirm happened, so it
    // still says untagged and unconfirmed. It must not win.
    const { client, state } = fakeClient({ data: [row()] });
    const { result } = renderHook(() => useFamilyMessages(client, scope));

    await act(async () =>
      state.handlers.UPDATE?.({
        new: row({ final_tier: 'action', acknowledged_at: '2026-09-15T10:00:00Z' }),
      }),
    );
    await act(async () => state.status?.('SUBSCRIBED'));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].finalTier).toBe('action');
    expect(result.current.messages[0].acknowledgedAt).toBe('2026-09-15T10:00:00Z');
  });

  it('holds patch to the same one-way guard, unless it says it is rolling back', async () => {
    const { client, state } = fakeClient({
      data: [row({ final_tier: 'action', acknowledged_at: '2026-09-15T10:00:00Z' })],
    });
    const { result } = renderHook(() => useFamilyMessages(client, scope));
    await act(async () => state.status?.('SUBSCRIBED'));

    await act(async () => result.current.patch('row-1', { finalTier: null, acknowledgedAt: null }));
    expect(result.current.messages[0].finalTier).toBe('action');
    expect(result.current.messages[0].acknowledgedAt).toBe('2026-09-15T10:00:00Z');

    // An optimistic update the database refused does have to move back.
    await act(async () =>
      result.current.patch('row-1', { acknowledgedAt: null }, { rollback: true }),
    );
    expect(result.current.messages[0].acknowledgedAt).toBeNull();
  });
});
