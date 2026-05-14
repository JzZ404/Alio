import type { ReactNode } from 'react';
import { MobileFrame, TabBar } from '@alio/ui';

export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <MobileFrame>
      <div className="relative overflow-hidden" style={{ height: '100svh' }}>
        {children}
        <TabBar className="absolute bottom-4 left-1/2 -translate-x-1/2" />
      </div>
    </MobileFrame>
  );
}
