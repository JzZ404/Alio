import Link from "next/link";

const CLIENTS = [
  {
    name: "Harold Jensen",
    age: 78,
    status: "Stable",
    lastVisit: "Today, 9:00 AM",
    nextVisit: "Thu, 9:00 AM",
    flag: false,
    initials: "HJ",
    diagnoses: ["Type 2 Diabetes", "Hypertension"],
  },
  {
    name: "Mary O'Brien",
    age: 82,
    status: "Monitor",
    lastVisit: "Yesterday",
    nextVisit: "Today, 2:00 PM",
    flag: true,
    initials: "MO",
    diagnoses: ["Arthritis", "Mild Cognitive Impairment"],
  },
];

function StatusBadge({ status, flag }: { status: string; flag: boolean }) {
  const color =
    status === "Stable"
      ? { bg: "#E8FFF0", text: "#22C55E" }
      : status === "Monitor"
      ? { bg: "#FFF8E8", text: "#F59E0B" }
      : { bg: "#FFE8E8", text: "#FF5555" };
  return (
    <span
      className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
      style={{ background: color.bg, color: color.text }}
    >
      {flag && <span>⚠️</span>}
      {status}
    </span>
  );
}

export default function CaregiverHome() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-[#5654FF] px-6 pt-12 pb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs font-medium tracking-wide mb-1">
              {dateStr}
            </p>
            <h1 className="text-white text-[26px] font-bold leading-tight">
              Good morning,<br />Sarah
            </h1>
          </div>
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">SM</span>
            </div>
          </div>
        </div>

        {/* Time */}
        <div className="bg-white/15 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-[11px]">Current time</p>
            <p className="text-white text-xl font-bold">{timeStr}</p>
          </div>
          <Link
            href="/caregiver/ai"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold"
            style={{ background: "#D5FF2C", color: "#1A1A2E" }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#1A1A2E" strokeWidth="2">
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0014 0" strokeLinecap="round" />
            </svg>
            Log Visit
          </Link>
        </div>
      </div>

      {/* Clients section */}
      <div className="px-5 pt-5 pb-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#1A1A2E] text-[17px]">My Clients</h2>
          <span className="text-[#9898B4] text-sm">{CLIENTS.length} active</span>
        </div>

        {CLIENTS.map((client) => (
          <Link
            key={client.name}
            href="/caregiver/ai"
            className="bg-white rounded-2xl p-4 flex flex-col gap-3 active:opacity-80"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-sm"
                style={{ background: "#5654FF" }}
              >
                {client.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-[#1A1A2E] text-[15px] truncate">
                    {client.name}
                  </h3>
                  <StatusBadge status={client.status} flag={client.flag} />
                </div>
                <p className="text-[#9898B4] text-[12px] mt-0.5">Age {client.age}</p>
              </div>
            </div>

            <div className="flex gap-2">
              {client.diagnoses.map((d) => (
                <span
                  key={d}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-[#F0F0FA] text-[#9898B4] truncate"
                >
                  {d}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#F0F0F8]">
              <div className="text-center">
                <p className="text-[10px] text-[#C4C4D4] font-medium">LAST VISIT</p>
                <p className="text-[12px] text-[#1A1A2E] font-medium mt-0.5">
                  {client.lastVisit}
                </p>
              </div>
              <div className="h-4 w-px bg-[#F0F0F8]" />
              <div className="text-center">
                <p className="text-[10px] text-[#C4C4D4] font-medium">NEXT VISIT</p>
                <p className="text-[12px] text-[#1A1A2E] font-medium mt-0.5">
                  {client.nextVisit}
                </p>
              </div>
              <div className="h-4 w-px bg-[#F0F0F8]" />
              <div className="text-center">
                <p className="text-[10px] text-[#C4C4D4] font-medium">ACTION</p>
                <span
                  className="text-[12px] font-semibold mt-0.5"
                  style={{ color: "#5654FF" }}
                >
                  Log visit →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
