import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export interface CaregiverLogRow {
  id: string;
  caregiver_id: string;
  patient_id: string;
  visit_date: string;
  transcript: string;
  summary: string | null;
  mood: string | null;
  medications_noted: string[];
  urgent: boolean;
  created_at: string;
}
