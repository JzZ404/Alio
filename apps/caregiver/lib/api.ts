const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const detail = await res
      .json()
      .then((d) => d.detail)
      .catch(() => res.statusText);
    throw new ApiError(res.status, String(detail));
  }
  return res.json() as Promise<T>;
}

export interface VisitSummary {
  summary: string;
  mood: string;
  medications_noted: string[];
  urgent: boolean;
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

export interface CompiledReportResponse {
  id: string;
  report: VisitReport;
  log_count: number;
  visit_date: string;
  visit_time: string;
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

export const api = {
  transcribe: (audio: Blob) =>
    request<{ transcript: string }>('/transcribe', {
      method: 'POST',
      body: audio,
      headers: { 'Content-Type': 'application/octet-stream' },
    }),

  summarize: (patient_name: string, transcript: string, notes = '') =>
    request<VisitSummary>('/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_name, transcript, notes }),
    }),

  compileLogs: (caregiver_id: string, patient_id: string, patient_name: string) =>
    request<CompiledReportResponse>('/caregiver-logs/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caregiver_id, patient_id, patient_name }),
    }),

  getCompiledReport: (id: string) =>
    request<CompiledReportRow>(`/caregiver-logs/report/${id}`),

  formatReportForFamily: (patient_name: string, visit_date: string, report: VisitReport) =>
    request<{ text: string }>('/caregiver-logs/report/format-for-family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_name, visit_date, report }),
    }),
};
