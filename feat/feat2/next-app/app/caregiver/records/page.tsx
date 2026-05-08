"use client";

import { useState, useEffect, useCallback } from "react";
import { api, Report } from "@/lib/api";

export default function CaregiverRecords() {
  const [dates, setDates] = useState<string[]>([]);
  const [reports, setReports] = useState<Record<string, Report>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const { dates: d } = await api.listReports();
      setDates(d);
      const entries = await Promise.all(
        d.map(async (date) => [date, await api.getReport(date)] as [string, Report])
      );
      setReports(Object.fromEntries(entries));
    } catch {
      /* no reports */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-5">
        <h1 className="text-[26px] font-bold text-[#1A1A2E]">Visit Logs</h1>
        <p className="text-[#9898B4] text-sm mt-1">Your submitted visit reports</p>
      </div>

      <div className="px-5 pt-5 pb-6 flex flex-col gap-3">
        {loading ? (
          <div className="text-center py-12 text-[#9898B4]">Loading logs…</div>
        ) : dates.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 flex flex-col items-center text-center gap-3">
            <span className="text-4xl">📝</span>
            <p className="font-semibold text-[#1A1A2E]">No visit logs yet</p>
            <p className="text-sm text-[#9898B4]">
              Use the AI tab to record and submit a visit.
            </p>
          </div>
        ) : (
          dates.map((date) => {
            const report = reports[date];
            const isOpen = expanded === date;
            return (
              <div key={date} className="bg-white rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : date)}
                  className="w-full flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: report?.urgent ? "#FFE8E8" : "#E8FFF0" }}
                    >
                      <span>{report?.urgent ? "⚠️" : "✓"}</span>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-[#1A1A2E] text-[15px]">{date}</p>
                      <p className="text-[12px] text-[#9898B4] mt-0.5 capitalize">
                        Mood: {report?.mood || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
                      style={{
                        background: report?.urgent ? "#FFE8E8" : "#E8FFF0",
                        color: report?.urgent ? "#FF5555" : "#22C55E",
                      }}
                    >
                      {report?.urgent ? "Urgent" : "Stable"}
                    </span>
                    <span className="text-[#C4C4D4] text-sm">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </button>
                {isOpen && report && (
                  <div className="px-5 pb-5 border-t border-[#F0F0F8] pt-4 flex flex-col gap-3">
                    <p className="text-sm text-[#1A1A2E] leading-relaxed">{report.summary}</p>
                    {report.medications_noted?.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-[#9898B4] uppercase tracking-wide mb-2">
                          Medications Noted
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {report.medications_noted.map((m) => (
                            <span
                              key={m}
                              className="text-[12px] px-2.5 py-1 rounded-full bg-[#EEF0FF] text-[#5654FF] font-medium"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {report.timestamp && (
                      <p className="text-[11px] text-[#C4C4D4]">
                        Submitted: {report.timestamp}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
