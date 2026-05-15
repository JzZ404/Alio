'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { MobileFrame } from '@alio/ui';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { IconHome, IconMicrophone, IconChat, IconMedicalRecord } from '@alio/ui';

const HomeTab     = dynamic(() => import('./home/page'),     { ssr: false });
const AICheckTab  = dynamic(() => import('./ai-check/page'), { ssr: false });
const ChatTab     = dynamic(() => import('./chat/page'),     { ssr: false });
const RecordsTab  = dynamic(() => import('./records/page'),  { ssr: false });

const TABS = ['home', 'ai-check', 'chat', 'records'] as const;
type Tab = typeof TABS[number];

const NAV_W = 365;
const NAV_H = 69;
const PAD = 5;
const SLOT_W = (NAV_W - PAD * 2) / 4;

const tabs = [
  { id: 'home'     as Tab, label: 'Home',    Icon: IconHome },
  { id: 'ai-check' as Tab, label: 'AI',      Icon: IconMicrophone },
  { id: 'chat'     as Tab, label: 'Chat',    Icon: IconChat },
  { id: 'records'  as Tab, label: 'Records', Icon: IconMedicalRecord },
];

export default function TabsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const isSubPage = segments.length > 1;

  const pathTab = segments[0] as Tab;
  const [active, setActive] = useState<Tab>(
    TABS.includes(pathTab) ? pathTab : 'home'
  );

  // Sync active tab when returning from a sub-page via back button
  useEffect(() => {
    if (!isSubPage && TABS.includes(pathTab)) {
      setActive(pathTab);
    }
  }, [pathname]);

  const activeIdx = tabs.findIndex(t => t.id === active);
  const isFirst = activeIdx === 0;
  const isLast  = activeIdx === tabs.length - 1;
  const pillLeft  = isFirst ? 0 : PAD + activeIdx * SLOT_W;
  const pillWidth = isFirst || isLast ? SLOT_W + PAD : SLOT_W;

  return (
    <MobileFrame>
      <div className="relative overflow-hidden" style={{ height: '100svh' }}>
        {isSubPage ? (
          // Detail pages render normally via Next.js routing
          <div className="absolute inset-0 overflow-y-auto">
            {children}
          </div>
        ) : (
          // Top-level tabs switch via state — no URL change
          <div className="absolute inset-0 bottom-[85px] overflow-y-auto">
            {active === 'home'     && <HomeTab />}
            {active === 'ai-check' && <AICheckTab />}
            {active === 'chat'     && <ChatTab />}
            {active === 'records'  && <RecordsTab />}
          </div>
        )}

        {!isSubPage && (
          <nav
            className="absolute flex items-stretch rounded-full border border-white/80 bg-white/40 shadow-[0_2px_22px_rgba(0,0,0,0.15)] backdrop-blur-2xl bottom-4 left-1/2 -translate-x-1/2"
            style={{ width: NAV_W, height: NAV_H, padding: PAD, position: 'absolute' }}
          >
            {activeIdx >= 0 && (
              <div
                className="absolute rounded-full bg-gray-30 transition-[left,width] duration-200 ease-out"
                style={{ top: PAD, bottom: PAD, left: pillLeft, width: pillWidth }}
              />
            )}
            {tabs.map((tab, idx) => {
              const isActive = idx === activeIdx;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1"
                >
                  <tab.Icon className={`size-6 ${isActive ? 'text-brand-active' : 'text-gray-100'}`} />
                  <span className={`text-[11.5px] font-bold leading-none ${isActive ? 'text-brand-active' : 'text-gray-100'}`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </MobileFrame>
  );
}
