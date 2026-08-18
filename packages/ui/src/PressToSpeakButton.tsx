import clsx from 'clsx';
import { Button } from './Button';
import { IconRiVoiceAiFill } from './icons';

/**
 * Bottom-center action button on Caregiver Logs screens.
 *
 * - `variant="idle"` → lime pill, "Press to Speak" + voice-AI waveform icon
 * - `variant="recording"` → red pill, "Done"
 */
export function PressToSpeakButton({
  onClick,
  variant = 'idle',
  className,
}: {
  onClick?: () => void;
  variant?: 'idle' | 'recording';
  className?: string;
}) {
  if (variant === 'recording') {
    return (
      <Button variant="danger" onClick={onClick} className={clsx('px-9', className)}>
        Done
      </Button>
    );
  }
  return (
    <Button variant="accent" onClick={onClick} className={clsx('px-9', className)}>
      <IconRiVoiceAiFill className="size-6 text-brand-active" />
      Press to Speak
    </Button>
  );
}
