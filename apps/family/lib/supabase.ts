import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export interface FamilyMessageRow {
  id: string;
  thread_id: string;
  sender: string;
  text: string;
  report_id: string | null;
  created_at: string;
}

export type Severity = 'critical' | 'warning' | 'good' | 'none';

export interface ReportFlag {
  severity: Severity;
  label: string;
  note: string | null;
}

export interface MedsFlag extends ReportFlag {
  meds: { name: string; taken: boolean }[];
}

export interface VisitReport {
  vitals: {
    bp: string | null;
    pulse: string | null;
    temp: string | null;
    flag: ReportFlag;
  };
  mood: {
    value: string;
    flag: ReportFlag;
  };
  meds: {
    status: string;
    flag: MedsFlag;
  };
}

export interface CompiledReportRow {
  id: string;
  caregiver_id: string;
  patient_id: string;
  patient_name: string;
  visit_date: string;
  visit_time: string | null;
  report: VisitReport;
  source_log_count: number;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function fetchCompiledReport(id: string): Promise<CompiledReportRow> {
  const res = await fetch(`${API_URL}/caregiver-logs/report/${id}`);
  if (!res.ok) throw new Error(`fetchCompiledReport: ${res.status}`);
  return res.json();
}
