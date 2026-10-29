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
function fakeClient(snapshot: {
  data?: FamilyMessageRow[];
  error?: { message: string };
  /** Runs just before the select resolves — i.e. while the query is in flight. */
  duringQuery?: () => void;
}) {
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
          return (resolve: (v: unknown) => void) => {
            snapshot.duringQuery?.();
            resolve({ data: snapshot.data ?? null, error: snapshot.error ?? null });
          };
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

  /*
   * The real race: the load is gated on SUBSCRIBED, but events still arrive
   * while its query is in flight, and those are newer than the rows coming
   * back. The snapshot here was read before the mark and the Confirm, so it
   * still says untagged and unconfirmed. It must not win.
   */
  it('does not let a snapshot undo an event that arrived while it was in flight', async () => {
    const state: { handlers: Record<string, (p: { new: FamilyMessageRow }) => void> } = {
      handlers: {},
    };
    const fake = fakeClient({
      data: [row()],
      duringQuery: () =>
        state.handlers.UPDATE?.({
          new: row({ final_tier: 'action', acknowledged_at: '2026-09-15T10:00:00Z' }),
        }),
    });
    state.handlers = fake.state.handlers;
    const { result } = renderHook(() => useFamilyMessages(fake.client, scope));
    await act(async () => fake.state.status?.('SUBSCRIBED'));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].finalTier).toBe('action');
    expect(result.current.messages[0].acknowledgedAt).toBe('2026-09-15T10:00:00Z');
  });

  /*
   * The mirror image, and the reason `finalTier` is no longer a one-way
   * field: un-marking has to reach the caregiver's screen, which never
   * performed it. A guard that only let the tag move one way would swallow
   * this and leave them chasing a request the family had withdrawn.
   */
  it('lets an un-mark through to a screen that did not perform it', async () => {
    const { client, state } = fakeClient({ data: [row({ final_tier: 'action' })] });
    const { result } = renderHook(() => useFamilyMessages(client, scope));
    await act(async () => state.status?.('SUBSCRIBED'));
    expect(result.current.messages[0].finalTier).toBe('action');

    await act(async () =>
      state.handlers.UPDATE?.({ new: row({ final_tier: null, tagged_by: null }) }),
    );
    expect(result.current.messages[0].finalTier).toBeNull();
  });

  it('holds patch to the confirmation guard, unless it says it is rolling back', async () => {
    const { client, state } = fakeClient({
      data: [row({ final_tier: 'action', acknowledged_at: '2026-09-15T10:00:00Z' })],
    });
    const { result } = renderHook(() => useFamilyMessages(client, scope));
    await act(async () => state.status?.('SUBSCRIBED'));

    await act(async () => result.current.patch('row-1', { acknowledgedAt: null }));
    expect(result.current.messages[0].acknowledgedAt).toBe('2026-09-15T10:00:00Z');

    // An optimistic update the database refused does have to move back.
    await act(async () =>
      result.current.patch('row-1', { acknowledgedAt: null }, { rollback: true }),
    );
    expect(result.current.messages[0].acknowledgedAt).toBeNull();
  });

  // Un-marking is an ordinary optimistic update now, so it must not need the
  // rollback escape hatch to take effect.
  it('lets patch take a mark back without asking for an exception', async () => {
    const { client, state } = fakeClient({ data: [row({ final_tier: 'action' })] });
    const { result } = renderHook(() => useFamilyMessages(client, scope));
    await act(async () => state.status?.('SUBSCRIBED'));

    await act(async () => result.current.patch('row-1', { finalTier: null }));
    expect(result.current.messages[0].finalTier).toBeNull();
  });

  /*
   * Spec section 9: "No model suggestions in the Pending list." The guarantee
   * is structural — `fromRow` never copies suggested_tier onto a
   * ThreadMessage, so `isPendingFor` and friends have nothing to read even if
   * someone wired them carelessly. These two tests pin both halves: the
   * suggestion does arrive, and it arrives somewhere the Pending surfaces
   * cannot see.
   */
  it('reports what the model suggested, keyed by message id', async () => {
    const { client, state } = fakeClient({ data: [row({ suggested_tier: 'action' })] });
    const { result } = renderHook(() => useFamilyMessages(client, scope));
    await act(async () => state.status?.('SUBSCRIBED'));

    expect(result.current.suggestions['row-1']).toBe('action');
  });

  it('keeps the suggestion off the message itself', async () => {
    const { client, state } = fakeClient({ data: [row({ suggested_tier: 'action' })] });
    const { result } = renderHook(() => useFamilyMessages(client, scope));
    await act(async () => state.status?.('SUBSCRIBED'));

    const message = result.current.messages[0];
    expect('suggestedTier' in message).toBe(false);
    // The message is still untagged, so nothing about it is Pending.
    expect(message.finalTier).toBeNull();
  });

  // A suggestion arriving later, once the classifier has answered, has to
  // reach the card the same way the snapshot's would.
  it('picks up a suggestion that arrives after the message did', async () => {
    const { client, state } = fakeClient({ data: [row()] });
    const { result } = renderHook(() => useFamilyMessages(client, scope));
    await act(async () => state.status?.('SUBSCRIBED'));
    expect(result.current.suggestions['row-1']).toBeUndefined();

    await act(async () =>
      state.handlers.UPDATE?.({ new: row({ suggested_tier: 'action', suggested_by: 'model' }) }),
    );
    expect(result.current.suggestions['row-1']).toBe('action');
  });
});
