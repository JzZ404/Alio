import { PressToSpeakButton } from '@alio/ui';

/** The bottom action button on Caregiver Logs — lime while idle, red while recording. */
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 16, width: 280 }}>{children}</div>
);

export const Idle = () => (
  <Stage>
    <PressToSpeakButton variant="idle" />
  </Stage>
);

export const Recording = () => (
  <Stage>
    <PressToSpeakButton variant="recording" />
  </Stage>
);
