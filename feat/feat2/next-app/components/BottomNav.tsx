"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ACTIVE_COLOR = "#5e69f6";
const INACTIVE_COLOR = "#28292c";

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? ACTIVE_COLOR : INACTIVE_COLOR;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  );
}

function AIIcon({ active }: { active: boolean }) {
  const c = active ? ACTIVE_COLOR : INACTIVE_COLOR;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v1m0 16v1M4.22 4.22l.7.7m13.16 13.16.7.7M3 12h1m16 0h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7"/>
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 8v1m0 6v1m-4-4h1m6 0h1"/>
    </svg>
  );
}

function ChatIcon({ active }: { active: boolean }) {
  const c = active ? ACTIVE_COLOR : INACTIVE_COLOR;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  );
}

function RecordsIcon({ active }: { active: boolean }) {
  const c = active ? ACTIVE_COLOR : INACTIVE_COLOR;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
      <line x1="9" y1="7" x2="15" y2="7"/>
      <line x1="9" y1="11" x2="15" y2="11"/>
      <line x1="9" y1="15" x2="13" y2="15"/>
    </svg>
  );
}

type Tab = {
  label: string;
  href: string;
  Icon: React.ComponentType<{ active: boolean }>;
};

export default function BottomNav({ role }: { role: "family" | "caregiver" }) {
  const pathname = usePathname();
  const base = `/${role}`;

  const tabs: Tab[] = [
    { label: "Home",    href: base,              Icon: HomeIcon    },
    { label: "AI",      href: `${base}/ai`,      Icon: AIIcon      },
    { label: "Chat",    href: `${base}/chat`,    Icon: ChatIcon    },
    { label: "Records", href: `${base}/records`, Icon: RecordsIcon },
  ];

  return (
    <nav
      className="flex-shrink-0 mx-3 mb-3 rounded-[60px] overflow-hidden relative"
      style={{
        background: "rgba(237,237,252,0.55)",
        border: "0.82px solid rgba(255,255,255,0.45)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Inner white pill shadow layer */}
      <div
        className="absolute inset-[3px] rounded-[56px] pointer-events-none"
        style={{
          background: "rgba(255,255,255,0.72)",
          boxShadow: "0px 2px 22px rgba(0,0,0,0.14)",
        }}
      />

      <div className="relative flex items-center h-[62px]">
        {tabs.map(({ label, href, Icon }) => {
          const active =
            pathname === href ||
            (href !== base && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] h-full relative z-10"
            >
              {active && (
                <span
                  className="absolute inset-y-[6px] left-[8%] right-[8%] rounded-[32px]"
                  style={{ background: "rgba(94,105,246,0.12)" }}
                />
              )}

              <span className="relative z-10">
                <Icon active={active} />
              </span>

              <span
                className="relative z-10 text-[11px] font-bold tracking-tight"
                style={{
                  color: active ? ACTIVE_COLOR : INACTIVE_COLOR,
                  fontFamily: "'Century Gothic', 'Century Gothic Std', Futura, 'Trebuchet MS', sans-serif",
                  opacity: active ? 1 : 0.55,
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
