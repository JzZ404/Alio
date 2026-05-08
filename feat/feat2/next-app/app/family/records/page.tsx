"use client";

import { useState, useEffect, useRef } from "react";
import { api, Prescription } from "@/lib/api";

function UploadIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function SyncIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}
function PillIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#5654FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 20.5L3.5 13.5a5 5 0 017.07-7.07l7 7a5 5 0 01-7.07 7.07z" />
      <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
    </svg>
  );
}

export default function FamilyRecords() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function fetchPrescriptions() {
    try {
      const { prescriptions: p } = await api.listPrescriptions();
      setPrescriptions(p);
    } catch {
      setError("Could not load records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await api.uploadPrescription(file);
      await fetchPrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError("");
    try {
      await api.syncPrescription();
      await fetchPrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  const current = prescriptions[0] ?? null;
  const history = prescriptions.slice(1);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-5">
        <h1 className="text-[26px] font-bold text-[#1A1A2E]">Medical Records</h1>
        <p className="text-[#9898B4] text-sm mt-1">Harold&#39;s prescriptions &amp; documents</p>
      </div>

      <div className="px-5 pt-5 pb-6 flex flex-col gap-4">
        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || syncing}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#5654FF" }}
          >
            <UploadIcon />
            {uploading ? "Uploading…" : "Upload PDF"}
          </button>
          <button
            onClick={handleSync}
            disabled={uploading || syncing}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#8B89FF" }}
          >
            <SyncIcon />
            {syncing ? "Syncing…" : "Sync EHR"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            className="hidden"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-[#9898B4]">Loading records…</div>
        ) : current ? (
          <div className="flex flex-col gap-3">
            {/* Current prescription */}
            <h2 className="text-sm font-semibold text-[#9898B4] uppercase tracking-wide">
              Current Prescription
            </h2>
            <div className="bg-white rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <PillIcon />
                  <span className="font-semibold text-[#1A1A2E]">Medications</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
                    style={{
                      background: current.source === "simulated_epic" ? "#EEF0FF" : "#F0F8FF",
                      color: current.source === "simulated_epic" ? "#5654FF" : "#3B82F6",
                    }}
                  >
                    {current.source === "simulated_epic" ? "Healthcare DB" : "Upload"}
                  </span>
                  <span className="text-[11px] text-[#9898B4]">
                    {new Date(current.uploaded_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {current.medications.map((med, i) => (
                  <div key={i} className="border-l-[3px] border-[#5654FF] pl-3">
                    <div className="font-semibold text-[#1A1A2E] text-[15px]">{med.name}</div>
                    <div className="text-sm text-[#9898B4] mt-0.5">{med.dosage}</div>
                    {med.instructions && (
                      <div className="text-sm text-[#B0B0C8] mt-0.5">{med.instructions}</div>
                    )}
                    {med.side_effects.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {med.side_effects.map((se, j) => (
                          <span
                            key={j}
                            className="text-[11px] px-2 py-0.5 rounded-full"
                            style={{ background: "#FFF0F0", color: "#FF5555" }}
                          >
                            {se}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* History */}
            {history.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-[#9898B4] uppercase tracking-wide mt-2">
                  History
                </h2>
                {history.map((p) => (
                  <div key={p.id} className="bg-white rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                      className="w-full flex items-center justify-between px-5 py-4"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#1A1A2E] font-medium">
                          {new Date(p.uploaded_at).toLocaleDateString()}
                        </span>
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: p.source === "simulated_epic" ? "#EEF0FF" : "#F0F8FF",
                            color: p.source === "simulated_epic" ? "#5654FF" : "#3B82F6",
                          }}
                        >
                          {p.source === "simulated_epic" ? "Healthcare DB" : "Upload"}
                        </span>
                      </div>
                      <span className="text-[#C4C4D4] text-sm">{expanded === p.id ? "▲" : "▼"}</span>
                    </button>
                    {expanded === p.id && (
                      <div className="px-5 pb-4 flex flex-col gap-3 border-t border-[#F0F0F8] pt-3">
                        {p.medications.map((med, i) => (
                          <div key={i} className="border-l-[3px] border-[#C4C4D4] pl-3">
                            <div className="font-medium text-[#1A1A2E]">{med.name}</div>
                            <div className="text-sm text-[#9898B4]">{med.dosage}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-10 flex flex-col items-center text-center gap-3">
            <span className="text-4xl">📋</span>
            <p className="font-semibold text-[#1A1A2E]">No records yet</p>
            <p className="text-sm text-[#9898B4]">
              Upload a PDF prescription or sync from the healthcare database.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
