import { TabBar } from '@alio/ui';

/**
 * TabBar is the glassmorphic bottom nav. It positions itself absolutely, so it
 * needs a positioned parent — in the apps that's the phone frame. The active
 * pill follows the current route; outside a Next app the DS bundle reports
 * `/home`, so Home reads as active here.
 */
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-[110px] w-[389px] rounded-2xl bg-gray-30 p-3">{children}</div>
);

export const Caregiver = () => (
  <Frame>
    <TabBar className="bottom-4 left-1/2 -translate-x-1/2" variant="caregiver" />
  </Frame>
);

export const Family = () => (
  <Frame>
    <TabBar className="bottom-4 left-1/2 -translate-x-1/2" variant="family" />
  </Frame>
);
