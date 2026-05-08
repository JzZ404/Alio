"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ACTIVE_COLOR  = "#5E69F6";
const INACTIVE_COLOR = "#28292C";

/* ── Actual Figma icon paths (node 79:1164) ── */

function HomeIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="23" viewBox="0 0 21.8675 22.9986" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M19.6785 7.38052L21.4965 9.03433C21.9497 9.43383 21.9938 10.1248 21.5951 10.5786C21.1956 11.0317 20.5047 11.0758 20.0508 10.6772L19.6785 10.3486V19.7129C19.6785 21.5276 18.2074 22.9986 16.3927 22.9986H13.107C12.5021 22.9986 12.0118 22.5083 12.0118 21.9034V16.4272C12.0164 16.1419 11.9012 15.8678 11.6942 15.6715C11.4911 15.4584 11.2108 15.336 10.9165 15.3319C10.3117 15.3319 9.82131 15.8223 9.82131 16.4272V21.9034C9.82131 22.5083 9.33096 22.9986 8.72607 22.9986H5.44036C3.62571 22.9986 2.15464 21.5276 2.15464 19.7129V10.3486L1.78226 10.6772C1.32564 11.045 0.660371 10.9879 0.273033 10.5478C-0.114304 10.1076 -0.0863069 9.44048 0.336547 9.03433L2.15464 7.38052L3.08559 6.57004L10.1937 0.272423C10.6072 -0.0908078 11.2259 -0.0908078 11.6394 0.272423L18.7475 6.57004L19.6785 7.38052ZM16.3927 20.8081C16.9976 20.8081 17.488 20.3178 17.488 19.7129V8.39909L10.9165 2.56147L4.34512 8.39909V19.7129C4.34512 20.3178 4.83547 20.8081 5.44036 20.8081H7.63083V16.4272C7.63083 14.6125 9.1019 13.1415 10.9165 13.1415C12.7312 13.1415 14.2023 14.6125 14.2023 16.4272V20.8081H16.3927Z" fill={color} />
    </svg>
  );
}

function AIIcon({ color }: { color: string }) {
  return (
    <svg width="17" height="21" viewBox="0 0 16.6174 20.7717" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M13.5016 9.34727C13.5016 12.2152 11.1767 14.5402 8.30868 14.5402C5.44071 14.5402 3.11576 12.2152 3.11576 9.34727V5.19292C3.11576 2.32495 5.44071 0 8.30868 0C11.1767 0 13.5016 2.32495 13.5016 5.19292V9.34727ZM8.30868 2.07717C6.5879 2.07717 5.19292 3.47214 5.19292 5.19293V9.34727C5.19292 11.068 6.5879 12.463 8.30868 12.463C10.0295 12.463 11.4244 11.068 11.4244 9.34727V5.19293C11.4244 3.47214 10.0295 2.07717 8.30868 2.07717ZM12.463 19.7331C12.463 20.3067 11.998 20.7717 11.4244 20.7717H5.19293C4.61933 20.7717 4.15434 20.3067 4.15434 19.7331C4.15434 19.1595 4.61933 18.6945 5.19293 18.6945H11.4244C11.998 18.6945 12.463 19.1595 12.463 19.7331ZM8.30868 17.6559C12.8974 17.6559 16.6174 13.936 16.6174 9.34727C16.6174 8.77367 16.1524 8.30868 15.5788 8.30868C15.0052 8.30868 14.5402 8.77367 14.5402 9.34727C14.5402 12.7888 11.7502 15.5788 8.30868 15.5788C4.86711 15.5788 2.07717 12.7888 2.07717 9.34727C2.07717 8.77367 1.61218 8.30868 1.03859 8.30868C0.46499 8.30868 0 8.77367 0 9.34727C0 13.936 3.71992 17.6559 8.30868 17.6559Z" fill={color} />
    </svg>
  );
}

function ChatIcon({ color }: { color: string }) {
  return (
    <svg width="21" height="21" viewBox="0 0 20.7717 20.7718" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M17.6559 4.15434H16.6174V3.11576C16.6174 1.39497 15.2224 0 13.5016 0H3.11576C1.39497 0 0 1.39497 0 3.11576V10.3858C0 12.1066 1.39497 13.5016 3.11576 13.5016V15.5788C3.11694 15.9699 3.33772 16.3271 3.68698 16.5031C3.8303 16.5809 3.99131 16.6202 4.15434 16.6174C4.37906 16.6174 4.59772 16.5445 4.77749 16.4096C5.36591 17.1942 6.28939 17.6559 7.27009 17.6559H12.1203L15.9942 20.564C16.174 20.6988 16.3926 20.7717 16.6174 20.7717C16.7804 20.7746 16.9414 20.7352 17.0847 20.6575C17.434 20.4815 17.6548 20.1242 17.6559 19.7331V17.6559C19.3767 17.6559 20.7717 16.261 20.7717 14.5402V7.27009C20.7717 5.54931 19.3767 4.15434 17.6559 4.15434ZM5.19293 13.5016V12.463C5.19293 11.8894 4.72793 11.4244 4.15434 11.4244H3.11576C2.54216 11.4244 2.07717 10.9594 2.07717 10.3859V3.11576C2.07717 2.54216 2.54216 2.07717 3.11576 2.07717H13.5016C14.0752 2.07717 14.5402 2.54216 14.5402 3.11576V10.3859C14.5402 10.9594 14.0752 11.4244 13.5016 11.4244H8.30868C8.08396 11.4244 7.8653 11.4973 7.68553 11.6322L5.19293 13.5016ZM17.6559 15.5788C18.2295 15.5788 18.6945 15.1138 18.6945 14.5402V7.2701C18.6945 6.6965 18.2295 6.23151 17.6559 6.23151H16.6174V10.3858C16.6174 12.1066 15.2224 13.5016 13.5016 13.5016H8.65141L6.46 15.153C6.64957 15.4126 6.94871 15.5699 7.27009 15.5788H12.463C12.6877 15.5788 12.9064 15.6517 13.0862 15.7865L15.5788 17.6559V16.6174C15.5788 16.0438 16.0438 15.5788 16.6174 15.5788H17.6559Z" fill={color} />
    </svg>
  );
}

function RecordsIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Document body */}
      <path fillRule="evenodd" clipRule="evenodd" d="M12 1H3C1.9 1 1 1.9 1 3V19C1 20.1 1.9 21 3 21H17C18.1 21 19 20.1 19 19V8L12 1ZM12 3.4L16.6 8H13C12.4 8 12 7.6 12 7V3.4ZM3 19V3H10V7C10 8.7 11.3 10 13 10H17V19H3Z" fill={color} />
      {/* Rx lines */}
      <rect x="5" y="12" width="7" height="1.5" rx="0.75" fill={color} />
      <rect x="5" y="15" width="5" height="1.5" rx="0.75" fill={color} />
    </svg>
  );
}

type Tab = {
  label: string;
  href: string;
  Icon: React.ComponentType<{ color: string }>;
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
    /* ── Apple Liquid Glass pill ── */
    <nav
      className="flex-shrink-0 mx-3 mb-3 rounded-[50px] overflow-hidden relative"
      style={{
        background: "rgba(255, 255, 255, 0.22)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        border: "0.5px solid rgba(255, 255, 255, 0.5)",
        boxShadow: [
          "0 8px 32px rgba(0,0,0,0.10)",
          "0 2px 6px rgba(0,0,0,0.06)",
          "inset 0 1px 0 rgba(255,255,255,0.85)",   /* top specular rim */
          "inset 0 -1px 0 rgba(0,0,0,0.06)",         /* bottom shadow rim */
        ].join(", "),
      }}
    >
      <div className="flex items-center h-[66px]">
        {tabs.map(({ label, href, Icon }) => {
          const active =
            pathname === href ||
            (href !== base && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] h-full relative"
            >
              {/* Active glass pill indicator */}
              {active && (
                <span
                  className="absolute inset-y-[6px] left-[6%] right-[6%] rounded-[32px]"
                  style={{
                    background: "rgba(255, 255, 255, 0.45)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    boxShadow: [
                      "inset 0 1px 0 rgba(255,255,255,0.9)",
                      "0 2px 8px rgba(0,0,0,0.08)",
                    ].join(", "),
                  }}
                />
              )}

              {/* Icon */}
              <span className="relative z-10 flex items-center justify-center h-[26px]">
                <Icon color={active ? ACTIVE_COLOR : INACTIVE_COLOR} />
              </span>

              {/* Label */}
              <span
                className="relative z-10 text-[11px] font-bold tracking-tight"
                style={{
                  color: active ? ACTIVE_COLOR : INACTIVE_COLOR,
                  fontFamily: "'Century Gothic', 'Century Gothic Std', Futura, 'Trebuchet MS', sans-serif",
                  opacity: active ? 1 : 0.6,
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
