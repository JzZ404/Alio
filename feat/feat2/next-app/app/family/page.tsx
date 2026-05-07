"use client";

import { useState, useEffect, useCallback } from "react";
import { api, Report } from "@/lib/api";

export default function FamilyPage() {
  const [dates, setDates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async (date: string) => {
    if (!date) return;
    setLoading(true);
    try {
      setReport(await api.getReport(date));
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDates = useCallback(async () => {
    const { dates: d } = await api.listReports();
    setDates(d);
    if (d.length > 0) {
      setSelected((prev) => prev || d[0]);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDates();
    const interval = setInterval(() => {
      fetchDates();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDates]);

  useEffect(() => {
    if (selected) fetchReport(selected);
  }, [selected, fetchReport]);

  if (!dates.length && !loading) {
    return (
      <main className="flex items-center justify-center min-h-screen p-8">
        <p className="text-gray-500 text-lg text-center">
          No reports submitted yet.
          <br />
          <span className="text-sm">Checking every 30 seconds…</span>
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6 p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">Family Report</h1>

      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="border border-gray-300 rounded-xl p-3 text-gray-800 bg-white"
      >
        {dates.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading…</p>
      ) : report ? (
        <div className="flex flex-col gap-4">
          {report.urgent && (
            <div className="bg-red-100 border border-red-400 text-red-700 rounded-xl p-4 font-semibold text-center">
              Urgent: Please contact the caregiver
            </div>
          )}

          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="font-semibold text-gray-600 mb-2 text-sm uppercase tracking-wide">
              Summary
            </h2>
            <p className="text-gray-800 leading-relaxed">{report.summary}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Mood</div>
              <div className="font-semibold text-gray-800 text-sm">
                {report.mood || "—"}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Medications</div>
              <div className="font-semibold text-gray-800 text-sm">
                {report.medications_noted?.length
                  ? report.medications_noted.join(", ")
                  : "None"}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div
                className={`font-semibold text-sm ${
                  report.urgent ? "text-red-600" : "text-green-600"
                }`}
              >
                {report.urgent ? "Urgent" : "All Good"}
              </div>
            </div>
          </div>

          {report.timestamp && (
            <p className="text-xs text-gray-400 text-right">
              Submitted: {report.timestamp}
            </p>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">
          No report for this date.
        </p>
      )}
    </main>
  );
}
