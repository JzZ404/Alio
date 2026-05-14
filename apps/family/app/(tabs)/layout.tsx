import type { ReactNode } from 'react';
import { MobileFrame, TabBar } from '@alio/ui';

export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <MobileFrame>
      <div className="relative h-dvh overflow-hidden sm:h-full sm:min-h-0">
        {children}
        <TabBar
          variant="family"
          className="absolute bottom-4 left-1/2 -translate-x-1/2"
        />
      </div>
    </MobileFrame>
  );
}
