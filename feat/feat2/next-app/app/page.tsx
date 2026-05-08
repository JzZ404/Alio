import Link from "next/link";

export default function Landing() {
  return (
    <div className="max-w-[390px] mx-auto min-h-screen flex flex-col">
      {/* Hero */}
      <div className="bg-[#5654FF] px-7 pt-20 pb-16">
        <div
          className="text-[11px] font-bold tracking-[0.2em] mb-5"
          style={{ color: "#D5FF2C" }}
        >
          ALIO
        </div>
        <h1 className="text-white text-[36px] font-bold leading-tight mb-3">
          When you can&#39;t<br />be there,<br />Alio is.
        </h1>
        <p className="text-white/60 text-sm leading-relaxed">
          AI-powered elder care for the<br />whole care circle.
        </p>
      </div>

      {/* Role selector */}
      <div className="flex-1 bg-[#EEEEF5] px-5 pt-8 pb-10 flex flex-col gap-3">
        <p className="text-[11px] font-semibold text-[#9898B4] uppercase tracking-widest mb-2">
          Continue as
        </p>

        <Link
          href="/family"
          className="bg-white rounded-2xl px-5 py-5 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#F0F0FA] flex items-center justify-center text-2xl flex-shrink-0">
            👩
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[#1A1A2E] text-[15px]">
              Family Member
            </div>
            <div className="text-[13px] text-[#9898B4] mt-0.5">
              Track your parent&#39;s daily care
            </div>
          </div>
          <span className="text-[#C4C4D4] text-xl font-light">›</span>
        </Link>

        <Link
          href="/caregiver"
          className="bg-white rounded-2xl px-5 py-5 flex items-center gap-4 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#F0F0FA] flex items-center justify-center text-2xl flex-shrink-0">
            🩺
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[#1A1A2E] text-[15px]">
              Caregiver
            </div>
            <div className="text-[13px] text-[#9898B4] mt-0.5">
              Log visits and voice notes
            </div>
          </div>
          <span className="text-[#C4C4D4] text-xl font-light">›</span>
        </Link>
      </div>
    </div>
  );
}
