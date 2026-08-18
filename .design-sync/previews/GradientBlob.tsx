import { GradientBlob } from '@alio/ui';

/**
 * GradientBlob is the soft watercolor wash behind the voice screens. It takes
 * its size from the wrapper; `active` runs the breathing pulse while recording.
 */
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: 'relative',
      width: 260,
      height: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-brand-tint-2)',
      borderRadius: 24,
      overflow: 'hidden',
    }}
  >
    {children}
  </div>
);

export const Resting = () => (
  <Stage>
    <GradientBlob className="size-40" />
  </Stage>
);

export const Listening = () => (
  <Stage>
    <GradientBlob className="size-40" active />
  </Stage>
);
