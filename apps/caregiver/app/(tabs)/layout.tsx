'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { MobileFrame, GlassNav } from '@alio/ui';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { IconHome, IconMicrophone, IconChat, IconProfile } from '@alio/ui';

const HomeTab      = dynamic(() => import('./home/page'),             { ssr: false });
const LogsTab      = dynamic(() => import('./logs/page'),             { ssr: false });
const ChatTab      = dynamic(() => import('./chat/page'),             { ssr: false });
const ProfilesTab  = dynamic(() => import('./profiles/page'),         { ssr: false });
const ChatDetail   = dynamic(() => import('./chat/[id]/page'),        { ssr: false });
const ReportDetail = dynamic(() => import('./logs/report/[id]/page'), { ssr: false });
const LogsHistory  = dynamic(() => import('./logs/history/page'),     { ssr: false });

const TABS = ['home', 'logs', 'chat', 'profiles'] as const;
type Tab = typeof TABS[number];
type SubPage =
  | { type: 'chat'; id: string }
  | { type: 'report'; id: string }
  | { type: 'logs-history' }
  | null;

const tabs = [
  { id: 'home' as Tab, label: 'Home', Icon: IconHome },
  { id: 'logs' as Tab, label: 'Log', Icon: IconMicrophone },
  { id: 'chat' as Tab, label: 'Chat', Icon: IconChat },
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
  return (
    <MobileFrame>
      {/* One background for the whole frame, so the tab bar floats on the
        * same surface as the content instead of a flat band below it. */}
      <div className="relative h-full overflow-hidden bg-app">
        <div className="absolute inset-0 bottom-[85px] overflow-y-auto">
          {subPage?.type === 'chat'   && <ChatDetail   id={subPage.id} onBack={() => setSubPage(null)} />}
          {subPage?.type === 'report' && <ReportDetail id={subPage.id} onBack={() => setSubPage(null)} />}
          {subPage?.type === 'logs-history' && <LogsHistory onBack={() => setSubPage(null)} />}
          {!subPage && active === 'home'     && <HomeTab />}
          {!subPage && active === 'logs'     && <LogsTab
            onOpenReport={(id) => setSubPage({ type: 'report', id })}
            onOpenHistory={() => setSubPage({ type: 'logs-history' })}
          />}
          {!subPage && active === 'chat'     && <ChatTab    onOpenThread={(id) => setSubPage({ type: 'chat',   id })} />}
          {!subPage && active === 'profiles' && <ProfilesTab />}
        </div>

        {/* The wrapper positions; GlassNav keeps `relative` for its own glass
          * layers. Passing `absolute` into the component would be overridden
          * by that `relative` and drop the bar at the top of the screen. */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <GlassNav
            tabs={tabs}
            activeIdx={activeIdx}
            onSelect={(id) => setActive(id as Tab)}
          />
        </div>
      </div>
    </MobileFrame>
  );
}
