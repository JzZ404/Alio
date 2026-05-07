const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const detail = await res
      .json()
      .then((d) => d.detail)
      .catch(() => res.statusText);
    throw new ApiError(res.status, String(detail));
  }
  return res.json() as Promise<T>;
}

export interface Report {
  summary: string;
  mood: string;
  medications_noted: string[];
  urgent: boolean;
  timestamp?: string;
}

export interface Medication {
  name: string;
  dosage: string;
  instructions: string;
  side_effects: string[];
}

export interface Prescription {
  id: string;
  patient_id: string;
  uploaded_at: string;
  source: "upload" | "simulated_epic";
  medications: Medication[];
}

export const api = {
  getPatient: () => request<{ name: string }>("/patient"),

  transcribe: (audio: Blob) =>
    request<{ transcript: string }>("/transcribe", {
      method: "POST",
      body: audio,
      headers: { "Content-Type": "application/octet-stream" },
    }),

  summarize: (patient_name: string, transcript: string, notes: string) =>
    request<Report>("/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_name, transcript, notes }),
    }),

  saveReport: (report: Omit<Report, "timestamp">) =>
    request<{ date: string }>("/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    }),

  listReports: () => request<{ dates: string[] }>("/reports"),

  getReport: (date: string) => request<Report>(`/reports/${date}`),

  uploadPrescription: (pdf: File) =>
    request<Prescription>("/prescriptions/upload", {
      method: "POST",
      body: pdf,
      headers: { "Content-Type": "application/pdf" },
    }),

  syncPrescription: () =>
    request<Prescription>("/prescriptions/sync", { method: "POST" }),

  listPrescriptions: () =>
    request<{ prescriptions: Prescription[] }>("/prescriptions"),
};
