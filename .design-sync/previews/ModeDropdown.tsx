import { ModeDropdown } from '@alio/ui';

/**
 * ModeDropdown is the "Alio voice / Alio message" switcher in the Logs header.
 * The menu opens on tap (internal state), so the cards show the two closed
 * modes — the label is the part that changes.
 */
const Header = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', padding: 16, width: 280, background: 'var(--color-brand-tint-2)' }}>
    {children}
  </div>
);

export const VoiceMode = () => (
  <Header>
    <ModeDropdown mode="voice" onChangeMode={() => {}} />
  </Header>
);

export const MessageMode = () => (
  <Header>
    <ModeDropdown mode="message" onChangeMode={() => {}} />
  </Header>
);
