"use client";

import { useState, useEffect, useRef } from "react";
import { api, Prescription, Medication } from "@/lib/api";

export default function MedicationsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchPrescriptions() {
    try {
      const { prescriptions: p } = await api.listPrescriptions();
      setPrescriptions(p);
    } catch {
      setError("Could not load prescriptions.");
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
      if (fileInputRef.current) fileInputRef.current.value = "";
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
    <main className="flex flex-col gap-6 p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">Medications</h1>

      <div className="flex gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || syncing}
          className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 text-sm"
        >
          {uploading ? "Uploading..." : "Upload Prescription"}
        </button>
        <button
          onClick={handleSync}
          disabled={uploading || syncing}
          className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 text-sm"
        >
          {syncing ? "Syncing..." : "Sync from Healthcare DB"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading...</p>
      ) : current ? (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">Current Prescription</h2>
              <SourceBadge source={current.source} />
            </div>
            <MedicationList medications={current.medications} />
            <p className="text-xs text-gray-400 mt-3">
              {new Date(current.uploaded_at).toLocaleDateString()}
            </p>
          </div>

          {history.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="font-semibold text-gray-700">History</h2>
              {history.map((p) => (
                <div key={p.id} className="bg-white rounded-xl shadow">
                  <button
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 text-sm">
                        {new Date(p.uploaded_at).toLocaleDateString()}
                      </span>
                      <SourceBadge source={p.source} />
                    </div>
                    <span className="text-gray-400 text-sm">
                      {expanded === p.id ? "▲" : "▼"}
                    </span>
                  </button>
                  {expanded === p.id && (
                    <div className="px-4 pb-4">
                      <MedicationList medications={p.medications} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-2">No prescriptions yet.</p>
          <p className="text-sm">
            Upload a PDF or sync from the healthcare database.
          </p>
        </div>
      )}
    </main>
  );
}

function SourceBadge({ source }: { source: "upload" | "simulated_epic" }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        source === "simulated_epic"
          ? "bg-purple-100 text-purple-700"
          : "bg-blue-100 text-blue-700"
      }`}
    >
      {source === "simulated_epic" ? "Healthcare DB" : "Upload"}
    </span>
  );
}

function MedicationList({ medications }: { medications: Medication[] }) {
  if (!medications.length) {
    return <p className="text-gray-400 text-sm">No medications listed.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {medications.map((med, i) => (
        <div key={i} className="border-l-4 border-blue-400 pl-3">
          <div className="font-semibold text-gray-800">{med.name}</div>
          <div className="text-sm text-gray-600">{med.dosage}</div>
          {med.instructions && (
            <div className="text-sm text-gray-500 mt-1">{med.instructions}</div>
          )}
          {med.side_effects.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {med.side_effects.map((se, j) => (
                <span
                  key={j}
                  className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full"
                >
                  {se}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
