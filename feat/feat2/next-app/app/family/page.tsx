"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { api, Report } from "@/lib/api";

/* ── tiny icon helpers ── */
function ShareIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#9898B4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#9898B4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#5654FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  );
}
function BarIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9898B4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

/* ── English-only Calendar ── */
const EN_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const EN_DAYS = ["M","T","W","T","F","S","S"];

function CalendarView() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const firstDow  = new Date(year, month, 1).getDay(); // 0=Sun
  const offset    = (firstDow + 6) % 7;                // Mon-based
  const daysInMon = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ];

  return (
    <div>
      <h3 className="font-bold text-[#1A1A2E] text-[15px] mb-4">
        {EN_MONTHS[month]} {year}
      </h3>
      <div className="grid grid-cols-7 gap-y-1">
        {EN_DAYS.map((d, i) => (
          <div key={i} className="text-center text-[11px] font-semibold pb-1"
            style={{ color: i >= 5 ? "#FF5555" : "#9898B4" }}>
            {d}
          </div>
        ))}
        {cells.map((d, i) => (
          <div key={i} className="flex items-center justify-center h-8">
            {d !== null && (
              <span
                className="w-7 h-7 flex items-center justify-center rounded-full text-[13px]"
                style={{
                  background: d === today ? "#5654FF" : "transparent",
                  color: d === today ? "#fff" : i % 7 >= 5 ? "#FF5555" : "#1A1A2E",
                  fontWeight: d === today ? 700 : 400,
                }}
              >
                {d}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Medication Card (matches Figma 123:1891) ── */
function MedicationCard({ count, name, dosage }: { count: number; name: string; dosage: string }) {
  return (
    <div className="flex-shrink-0 bg-white rounded-[12px] p-2 pt-2.5 w-[92px] flex flex-col gap-[7px]">
      {/* Header row */}
      <div className="flex items-center gap-1">
        <span
          className="text-[10px] font-bold leading-tight"
          style={{ color: "#181818", fontFamily: "'Century Gothic', 'Century Gothic Std', Futura, sans-serif" }}
        >
          Medications
        </span>
        <span
          className="w-[14px] h-[14px] rounded-[3px] flex items-center justify-center text-[8px] font-bold flex-shrink-0"
          style={{ background: "#EAEAF2", color: "#181818", fontFamily: "'Century Gothic', sans-serif" }}
        >
          {count}
        </span>
      </div>

      {/* Pill icon + name/dosage */}
      <div className="flex flex-col gap-[3px]">
        <div
          className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center"
          style={{ background: "#EAEAF2" }}
        >
          <Image src="/icons/pills.png" alt="pills" width={20} height={20} />
        </div>
        <div className="flex flex-col leading-[16px]">
          <span
            className="text-[8px] font-bold"
            style={{ color: "#181818", fontFamily: "'Century Gothic', 'Century Gothic Std', Futura, sans-serif" }}
          >
            {name}
          </span>
          <span
            className="text-[8px]"
            style={{ color: "#181818", fontFamily: "'Century Gothic', 'Century Gothic Std', Futura, sans-serif" }}
          >
            {dosage}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function FamilyHome() {
  const [report, setReport]   = useState<Report | null>(null);
  const [lastDate, setLastDate] = useState("");

  const loadLatest = useCallback(async () => {
    try {
      const { dates } = await api.listReports();
      if (dates.length > 0) {
        setLastDate(dates[0]);
        setReport(await api.getReport(dates[0]));
      }
    } catch { /* no reports yet */ }
  }, []);

  useEffect(() => {
    loadLatest();
    const id = setInterval(loadLatest, 30_000);
    return () => clearInterval(id);
  }, [loadLatest]);

  const statusText = report?.urgent
    ? "Harold needs attention."
    : report?.summary
    ? "Harold is stable today."
    : "No report yet today.";

  return (
    /* Relative so the FAB can be fixed inside the max-w shell */
    <div className="flex flex-col pb-4">

      {/* ── Header ── */}
      <div className="bg-white px-6 pt-12 pb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-[#1A1A2E] leading-tight">Janet</h1>
          <p className="text-[#9898B4] text-sm mt-0.5">Harold&apos;s care</p>
        </div>
        <div className="flex gap-2 mt-1">
          <button className="w-9 h-9 rounded-full bg-[#F0F0FA] flex items-center justify-center">
            <ShareIcon />
          </button>
          <button className="w-9 h-9 rounded-full bg-[#F0F0FA] flex items-center justify-center">
            <BellIcon />
          </button>
        </div>
      </div>

      {/* ── Caregiver Status ── */}
      <div className="px-6 pt-3 pb-3 flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-[19px] font-bold text-[#1A1A2E] leading-tight">Caregiver on the way</h2>
          <p className="text-[#9898B4] text-sm mt-0.5">Sarah Mitchell</p>
        </div>
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-[#5654FF]/15 flex items-center justify-center">
            <span className="text-[#5654FF] text-sm font-bold">SM</span>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#22C55E] border-2 border-white block" />
        </div>
      </div>

      {/* ── Today's Status Card ── */}
      <div className="mx-5 rounded-[20px] bg-[#5654FF] p-5">
        {report?.urgent && (
          <div className="bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg mb-3 flex items-center gap-1.5">
            <span>⚠️</span> Urgent — please contact caregiver
          </div>
        )}
        <p className="text-white/70 text-[11px] font-semibold uppercase tracking-wider mb-1.5">
          Today&apos;s Status
        </p>
        <h3 className="text-white text-[20px] font-bold mb-4 leading-snug">{statusText}</h3>

        {/* Vitals row — horizontally scrollable */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">

          {/* Medication card — Figma-accurate */}
          <MedicationCard
            count={report?.medications_noted?.length ?? 2}
            name={report?.medications_noted?.[0] ?? "Metformin"}
            dosage="150mg"
          />

          {/* Blood count */}
          <div className="flex-shrink-0 bg-white rounded-xl p-3 w-[82px]">
            <div className="mb-2"><BarIcon /></div>
            <p className="text-[10px] text-[#9898B4] leading-tight">Blood Count</p>
            <p className="text-[13px] font-semibold text-[#1A1A2E] mt-0.5">80–90</p>
          </div>

          {/* Heart rate */}
          <div className="flex-shrink-0 bg-white rounded-xl p-3 w-[82px]">
            <div className="mb-2"><HeartIcon /></div>
            <p className="text-[10px] text-[#9898B4] leading-tight">Heart Rate</p>
            <p className="text-[13px] font-semibold text-[#1A1A2E] mt-0.5">120 bpm</p>
          </div>

          {/* Mood */}
          <div className="flex-shrink-0 bg-white rounded-xl p-3 w-[82px]">
            <div className="mb-2 text-[18px]">😊</div>
            <p className="text-[10px] text-[#9898B4] leading-tight">Mood</p>
            <p className="text-[13px] font-semibold text-[#1A1A2E] mt-0.5 capitalize">
              {report?.mood || "Good"}
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button className="bg-white/20 text-white text-[13px] font-semibold px-4 py-2 rounded-xl">
            View All →
          </button>
        </div>
        {lastDate && (
          <p className="text-white/40 text-[10px] mt-2">Last visit: {lastDate}</p>
        )}
      </div>

      {/* ── Calendar ── */}
      <div className="mx-5 mt-4 bg-white rounded-[20px] p-5">
        <CalendarView />
      </div>

      {/* ── FAB — fixed inside the phone shell ── */}
      <button
        className="fixed bottom-[84px] right-4 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg text-xl font-bold z-40"
        style={{
          background: "#D5FF2C",
          color: "#1A1A2E",
          /* cap to the max-w shell */
          maxWidth: "calc(390px - 16px)",
        }}
        aria-label="Add event"
      >
        +
      </button>
    </div>
  );
}
