import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fromRow, type FamilyMessageRow, type ThreadMessage } from './types';
import { mergeMessage } from './pending';

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
 * `patch` is for optimistic updates — a Confirm tap should not wait on the
 * network. `upsert` takes the row a write returned.
 */
export function useFamilyMessages(client: SupabaseClient, scope: MessageScope | null) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);

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

    const apply = (row: FamilyMessageRow) => {
      if (!cancelled) setMessages((prev) => mergeMessage(prev, fromRow(row)));
    };

    const load = async () => {
      const base = client.from('family_messages').select('*');
      const query =
        scope.by === 'thread'
          ? base.eq('thread_id', scope.threadId)
          : base
              .eq('recipient_id', scope.recipientId)
              .eq('final_tier', 'action')
              .or(`acknowledged_at.is.null,acknowledged_at.gte.${since}`);
      const { data, error } = await query.order('created_at');
      if (error) {
        console.error('useFamilyMessages:', error.message);
        return;
      }
      for (const row of (data ?? []) as FamilyMessageRow[]) apply(row);
    };

    const channel = client
      .channel(`family_messages:${filter}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'family_messages', filter },
        (payload) => apply(payload.new as FamilyMessageRow),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'family_messages', filter },
        (payload) => apply(payload.new as FamilyMessageRow),
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        void load();
      });

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
    // `filter` and `since` are the scope's identity; the object is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, filter, since]);

  const patch = useCallback((id: string, changes: Partial<ThreadMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)));
  }, []);

  const upsert = useCallback((row: FamilyMessageRow) => {
    setMessages((prev) => mergeMessage(prev, fromRow(row)));
  }, []);

  return { messages, patch, upsert };
}
