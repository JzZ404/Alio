export type Tier = 'action' | 'fyi' | 'social';

/** One `family_messages` row exactly as Supabase returns it. */
export interface FamilyMessageRow {
  id: string;
  thread_id: string;
  sender: string;
  sender_id: string | null;
  recipient_id: string | null;
  text: string;
  report_id: string | null;
  final_tier: Tier | null;
  tagged_by: 'sender_manual' | 'sender_confirmed_ai' | null;
  suggested_tier: Tier | null;
  suggested_by: 'model' | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  followup_sent_at: string | null;
  created_at: string;
}

/**
 * The shape screens work with. Deliberately omits suggested_tier: a model
 * suggestion must never reach a Pending surface (spec §9).
 */
export interface ThreadMessage {
  id: string;
  threadId: string;
  senderId: string | null;
  recipientId: string | null;
  senderName: string;
  text: string;
  reportId: string | null;
  finalTier: Tier | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export function fromRow(row: FamilyMessageRow): ThreadMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    senderName: row.sender,
    text: row.text,
    reportId: row.report_id,
    finalTier: row.final_tier,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
  };
}
