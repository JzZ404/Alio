'use client';

import { useState } from 'react';
import { MobileFrame } from '@alio/ui';
import dynamic from 'next/dynamic';
import { IconHome, IconMicrophone, IconChat, IconProfile } from '@alio/ui';

const HomeTab = dynamic(() => import('./home/page'), { ssr: false });
const LogsTab = dynamic(() => import('./logs/page'), { ssr: false });
const ChatTab = dynamic(() => import('./chat/page'), { ssr: false });
const ProfilesTab = dynamic(() => import('./profiles/page'), { ssr: false });

const TABS = ['home', 'logs', 'chat', 'profiles'] as const;
type Tab = typeof TABS[number];

const NAV_W = 365;
const NAV_H = 69;
const PAD = 5;
const SLOT_W = (NAV_W - PAD * 2) / 4;

export default function TabsLayout() {
  const [active, setActive] = useState<Tab>('home');

  const tabs = [
    { id: 'home' as Tab, label: 'Home', Icon: IconHome },
    { id: 'logs' as Tab, label: 'Log', Icon: IconMicrophone },
    { id: 'chat' as Tab, label: 'Chat', Icon: IconChat },
    { id: 'profiles' as Tab, label: 'Profiles', Icon: IconProfile },
  ];

  const activeIdx = tabs.findIndex(t => t.id === active);
  const isFirst = activeIdx === 0;
  const isLast = activeIdx === tabs.length - 1;
  const pillLeft = isFirst ? 0 : PAD + activeIdx * SLOT_W;
  const pillWidth = isFirst || isLast ? SLOT_W + PAD : SLOT_W;

  return (
    <MobileFrame>
      <div className="relative overflow-hidden" style={{ height: '100svh' }}>
        <div className="absolute inset-0 bottom-[85px] overflow-y-auto">
          {active === 'home' && <HomeTab />}
          {active === 'logs' && <LogsTab />}
          {active === 'chat' && <ChatTab />}
          {active === 'profiles' && <ProfilesTab />}
        </div>

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
      </div>
    </MobileFrame>
  );
}
