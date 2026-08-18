import { VoiceListeningView } from '@alio/ui';

/**
 * The AI voice state shared by Caregiver Logs and Family AI Check. Idle holds
 * the gradient still; listening slides it left-to-right while the blob breathes
 * and the live transcript fades all but the newest words.
 *
 * It positions itself absolutely, so the card frames it in a phone-sized stage.
 */
const Screen = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: 'relative',
      width: 393,
      height: 700,
      overflow: 'hidden',
      borderRadius: 24,
      background: 'var(--color-brand-tint-2)',
    }}
  >
    {children}
  </div>
);

export const Idle = () => (
  <Screen>
    <VoiceListeningView />
  </Screen>
);

export const Listening = () => (
  <Screen>
    <VoiceListeningView
      listening
      transcript="I just measured the blood pressure and the results shows normal. Gonna give her her daily medication next."
    />
  </Screen>
);
