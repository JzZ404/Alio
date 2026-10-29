'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fromRow, type FamilyMessageRow, type ThreadMessage, type Tier } from './types';
import { keepOneWayFields, mergeMessage } from './pending';

export type MessageScope =
  | { by: 'thread'; threadId: string }
  | { by: 'recipient'; recipientId: string; since: Date };

/**
 * Live `family_messages` for one scope: an initial select, then realtime INSERT
 * and UPDATE merged by id. The initial load runs only once the channel reports
 * SUBSCRIBED, so no write can land in the gap between the snapshot and the
 * subscription going live; if the socket drops and rejoins, SUBSCRIBED fires
 * again and the reload heals whatever was missed while it was away, which is
 * safe because mergeMessage merges by id.
 *
 * `error` is the flip side of that choice. When the load fails, or the channel
 * never goes live, this hook has nothing to show — and for a feature whose
 * premise is that a request never gets lost, an unreachable backend must not
 * render as a confident empty inbox. Screens read this flag and say so.
 *
 * A live event always beats the snapshot for the same message. The load's
 * query is sent after SUBSCRIBED, but events can still arrive while it is in
 * flight, and those are newer than the rows coming back. `liveIds` records
 * which messages that happened to, and the snapshot skips them. This replaced
 * making `finalTier` one-way in the merge, which only protected changes in
 * one direction and so could not survive un-marking.
 *
 * `suggestions` is what the model thinks, keyed by message id — deliberately
 * *beside* the messages rather than on them. Spec §9 says a model suggestion
 * never reaches the Pending list; keeping it off `ThreadMessage` means the
 * Pending selectors cannot read it even by mistake. Only the ALIO SUGGESTS
 * card asks for it.
 *
 * `patch` is for optimistic updates — a Confirm tap should not wait on the
 * network. `upsert` takes the row a write returned.
 */
export function useFamilyMessages(client: SupabaseClient, scope: MessageScope | null) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, Tier>>({});
  const [error, setError] = useState(false);
  // Messages this client has newer knowledge of than any snapshot in flight.
  // Cleared when a load starts, so a rejoin still heals everything it missed.
  const liveIds = useRef<Set<string>>(new Set());

  const filter =
    scope === null
      ? null
      : scope.by === 'thread'
        ? `thread_id=eq.${scope.threadId}`
        : `recipient_id=eq.${scope.recipientId}`;
  const since = scope?.by === 'recipient' ? scope.since.toISOString() : null;

  useEffect(() => {
    if (scope === null || filter === null) return;
    let cancelled = false;
    setMessages([]);
    setSuggestions({});
    setError(false);

    const apply = (row: FamilyMessageRow) => {
      if (cancelled) return;
      setMessages((prev) => mergeMessage(prev, fromRow(row)));
      // Suggestions are one-way in the database too (transition 3 fires only
      // while suggested_tier is null), so a row that has one always carries
      // it and there is nothing to clear.
      if (row.suggested_tier) {
        setSuggestions((prev) => ({ ...prev, [row.id]: row.suggested_tier as Tier }));
      }
    };

    /** A realtime event, or a row a write just returned: authoritative. */
    const applyLive = (row: FamilyMessageRow) => {
      liveIds.current.add(row.id);
      apply(row);
    };

    const load = async () => {
      // From here on, anything arriving live is newer than what comes back.
      liveIds.current.clear();
      const base = client.from('family_messages').select('*');
      const query =
        scope.by === 'thread'
          ? base.eq('thread_id', scope.threadId)
          : base
              .eq('recipient_id', scope.recipientId)
              .eq('final_tier', 'action')
              .or(`acknowledged_at.is.null,acknowledged_at.gte.${since}`);
      const { data, error: loadError } = await query.order('created_at');
      if (cancelled) return;
      if (loadError) {
        console.error('useFamilyMessages:', loadError.message);
        setError(true);
        return;
      }
      for (const row of (data ?? []) as FamilyMessageRow[]) {
        // An event landed for this message while the query was in flight, so
        // the snapshot is the older of the two and has nothing to add.
        if (liveIds.current.has(row.id)) continue;
        apply(row);
      }
      // A rejoin after a failure clears the flag, so the line a screen shows
      // disappears on its own once the data is actually there.
      setError(false);
    };

    const channel = client
      .channel(`family_messages:${filter}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'family_messages', filter },
        (payload) => applyLive(payload.new as FamilyMessageRow),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'family_messages', filter },
        (payload) => applyLive(payload.new as FamilyMessageRow),
      )
      .subscribe((status, subscribeError) => {
        // `cancelled` first: removeChannel on unmount reports CLOSED, which is
        // the expected end of a channel's life, not a failure worth logging.
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          void load();
          return;
        }
        // TIMED_OUT / CLOSED / CHANNEL_ERROR. Silence here was the worst of the
        // failure modes: no load ever ran, nothing was logged, and the screen
        // said "Nothing pending" with complete confidence.
        console.error('useFamilyMessages: channel', status, subscribeError?.message ?? '');
        setError(true);
      });

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
    // `filter` and `since` are the scope's identity; the object is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, filter, since]);

  /**
   * Optimistic local update, through the same guard realtime merges use, so
   * an in-flight change can never quietly un-confirm a message.
   *
   * `rollback` is the one deliberate exception: undoing an optimistic update
   * the database refused is exactly when a one-way field must move back, and
   * the caller has to ask for it by name.
   *
   * Either way the message counts as locally known, so a snapshot still in
   * flight cannot overwrite it with what the row looked like beforehand.
   */
  const patch = useCallback(
    (id: string, changes: Partial<ThreadMessage>, { rollback = false } = {}) => {
      liveIds.current.add(id);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          const next = { ...m, ...changes };
          return rollback ? next : keepOneWayFields(m, next);
        }),
      );
    },
    [],
  );

  const upsert = useCallback((row: FamilyMessageRow) => {
    liveIds.current.add(row.id);
    setMessages((prev) => mergeMessage(prev, fromRow(row)));
    if (row.suggested_tier) {
      setSuggestions((prev) => ({ ...prev, [row.id]: row.suggested_tier as Tier }));
    }
  }, []);

  return { messages, suggestions, error, patch, upsert };
}
