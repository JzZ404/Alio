import type { SupabaseClient } from '@supabase/supabase-js';
import type { FamilyMessageRow } from './types';
import { DISPLAY_NAME, otherParticipant } from './participants';

/** Writes one chat message. `needsResponse` is the sender's own tag, never a model's. */
export async function sendMessage(
  client: SupabaseClient,
  params: { threadId: string; senderId: string; text: string; needsResponse: boolean },
): Promise<FamilyMessageRow> {
  const { data, error } = await client
    .from('family_messages')
    .insert({
      thread_id: params.threadId,
      sender: DISPLAY_NAME[params.senderId] ?? params.senderId,
      sender_id: params.senderId,
      recipient_id: otherParticipant(params.senderId),
      text: params.text,
      final_tier: params.needsResponse ? 'action' : null,
      tagged_by: params.needsResponse ? 'sender_manual' : null,
    })
    .select()
    .single();
  if (error) throw new Error(`sendMessage: ${error.message}`);
  return data as FamilyMessageRow;
}

/**
 * Confirm (spec §0: `acknowledge`). Filtered on acknowledged_at is null so a
 * second tap, or a second device, cannot overwrite the first confirmation time.
 */
export async function acknowledgeMessage(
  client: SupabaseClient,
  params: { messageId: string; userId: string; at?: Date },
): Promise<void> {
  const { error } = await client
    .from('family_messages')
    .update({
      acknowledged_at: (params.at ?? new Date()).toISOString(),
      acknowledged_by: params.userId,
    })
    .eq('id', params.messageId)
    .is('acknowledged_at', null);
  if (error) throw new Error(`acknowledgeMessage: ${error.message}`);
}
