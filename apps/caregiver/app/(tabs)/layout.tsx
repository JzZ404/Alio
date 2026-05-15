'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { MobileFrame } from '@alio/ui';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { IconHome, IconMicrophone, IconChat, IconProfile } from '@alio/ui';

const HomeTab      = dynamic(() => import('./home/page'),             { ssr: false });
const LogsTab      = dynamic(() => import('./logs/page'),             { ssr: false });
const ChatTab      = dynamic(() => import('./chat/page'),             { ssr: false });
const ProfilesTab  = dynamic(() => import('./profiles/page'),         { ssr: false });
const ChatDetail   = dynamic(() => import('./chat/[id]/page'),        { ssr: false });
const ReportDetail = dynamic(() => import('./logs/report/[id]/page'), { ssr: false });

const TABS = ['home', 'logs', 'chat', 'profiles'] as const;
type Tab = typeof TABS[number];
type SubPage = { type: 'chat'; id: string } | { type: 'report'; id: string } | null;

const NAV_W = 365;
const NAV_H = 69;
const PAD = 5;
const SLOT_W = (NAV_W - PAD * 2) / 4;

const tabs = [
  { id: 'home'     as Tab, label: 'Home',     Icon: IconHome },
  { id: 'logs'     as Tab, label: 'Log',      Icon: IconMicrophone },
  { id: 'chat'     as Tab, label: 'Chat',     Icon: IconChat },
  { id: 'profiles' as Tab, label: 'Profiles', Icon: IconProfile },
];

export default function TabsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const pathTab = segments[0] as Tab;
  const [active, setActive] = useState<Tab>(TABS.includes(pathTab) ? pathTab : 'home');
  const [subPage, setSubPage] = useState<SubPage>(null);

  useEffect(() => {
    if (TABS.includes(pathTab)) setActive(pathTab);
    setSubPage(null);
  }, [pathname]);

  const activeIdx = tabs.findIndex(t => t.id === active);
  const isFirst = activeIdx === 0;
  const isLast  = activeIdx === tabs.length - 1;
  const pillLeft  = isFirst ? 0 : PAD + activeIdx * SLOT_W;
  const pillWidth = isFirst || isLast ? SLOT_W + PAD : SLOT_W;

  return (
    <MobileFrame>
      <div className="relative overflow-hidden" style={{ height: '100svh' }}>
        <div className="absolute inset-0 bottom-[85px] overflow-y-auto">
          {subPage?.type === 'chat'   && <ChatDetail   id={subPage.id} onBack={() => setSubPage(null)} />}
          {subPage?.type === 'report' && <ReportDetail id={subPage.id} onBack={() => setSubPage(null)} />}
          {!subPage && active === 'home'     && <HomeTab />}
          {!subPage && active === 'logs'     && <LogsTab    onOpenReport={(id) => setSubPage({ type: 'report', id })} />}
          {!subPage && active === 'chat'     && <ChatTab    onOpenThread={(id) => setSubPage({ type: 'chat',   id })} />}
          {!subPage && active === 'profiles' && <ProfilesTab />}
        </div>

        {!subPage && (
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
                <button key={tab.id} onClick={() => setActive(tab.id)}
                  className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1">
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
