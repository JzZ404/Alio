'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { MobileFrame, GlassNav, CAREGIVER_THREAD_FOR_SUPABASE } from '@alio/ui';
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
const PendingScreen = dynamic(
  () => import('@/components/PendingScreen').then((m) => m.PendingScreen),
  { ssr: false },
);

const TABS = ['home', 'logs', 'chat', 'profiles'] as const;
type Tab = typeof TABS[number];
type SubPage =
  | { type: 'chat'; id: string; focusMessageId?: string; from?: 'pending' }
  | { type: 'report'; id: string }
  | { type: 'pending'; tab: 'pending' | 'confirmed' }
  | { type: 'logs-history' }
  | null;

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
  // Which way the last navigation went, so the arriving screen animates in from
  // the side it came from. Tab switches imply no direction and simply lift.
  const [direction, setDirection] = useState<'forward' | 'back' | 'fade'>('fade');

  const open = (next: Exclude<SubPage, null>) => {
    setDirection('forward');
    setSubPage(next);
  };
  const goBack = (next: SubPage = null) => {
    setDirection('back');
    setSubPage(next);
  };
  const switchTab = (tab: Tab) => {
    setDirection('fade');
    setActive(tab);
  };

  useEffect(() => {
    if (TABS.includes(pathTab)) setActive(pathTab);
    setSubPage(null);
  }, [pathname]);

  // Changing this key restarts the animation on every navigation.
  const screenKey = subPage
    ? `${subPage.type}:${'id' in subPage ? subPage.id : 'tab' in subPage ? subPage.tab : ''}`
    : `tab:${active}`;
  const screenAnimation =
    direction === 'forward'
      ? 'animate-screen-in-right'
      : direction === 'back'
        ? 'animate-screen-in-left'
        : 'animate-screen-fade';

  const activeIdx = tabs.findIndex(t => t.id === active);

  return (
    <MobileFrame>
      {/* One background for the whole frame, so the tab bar floats on the
        * same surface as the content instead of a flat band below it. */}
      <div className="relative h-full overflow-hidden bg-app">
        <div className="absolute inset-0 bottom-[85px] overflow-y-auto">
          <div key={screenKey} className={`h-full ${screenAnimation}`}>
          {subPage?.type === 'chat'    && <ChatDetail   id={subPage.id} focusMessageId={subPage.focusMessageId} onBack={() => goBack(subPage.from === 'pending' ? { type: 'pending', tab: 'pending' } : null)} />}
          {subPage?.type === 'report'  && <ReportDetail id={subPage.id} onBack={() => goBack()} />}
          {subPage?.type === 'pending' && <PendingScreen initialTab={subPage.tab} onBack={() => goBack()} onOpenMessage={(m) => { const chatId = CAREGIVER_THREAD_FOR_SUPABASE[m.threadId]; if (chatId) open({ type: 'chat', id: chatId, focusMessageId: m.id, from: 'pending' }); }} />}
          {subPage?.type === 'logs-history' && <LogsHistory onBack={() => goBack()} />}
          {!subPage && active === 'home'     && <HomeTab onOpenPending={() => open({ type: 'pending', tab: 'pending' })} />}
          {!subPage && active === 'logs'     && <LogsTab
            onOpenReport={(id) => open({ type: 'report', id })}
            onOpenHistory={() => open({ type: 'logs-history' })}
          />}
          {!subPage && active === 'chat'     && <ChatTab    onOpenThread={(id) => open({ type: 'chat',   id })} onOpenPending={(tab) => open({ type: 'pending', tab })} />}
          {!subPage && active === 'profiles' && <ProfilesTab />}
          </div>
        </div>

        {/* The wrapper positions; GlassNav keeps `relative` for its own glass
          * layers. Passing `absolute` into the component would be overridden
          * by that `relative` and drop the bar at the top of the screen. */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <GlassNav
            tabs={tabs}
            activeIdx={activeIdx}
            onSelect={(id) => switchTab(id as Tab)}
          />
        </div>
      </div>
    </MobileFrame>
  );
}
