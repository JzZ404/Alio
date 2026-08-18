import clsx from 'clsx';
import { GradientBlob } from './GradientBlob';

/**
 * VoiceListeningView — the AI voice state shared by caregiver Logs and family
 * AI Check: the gradient headline, the watercolor blob, and the live transcript.
 *
 * While `listening` the headline gradient slides left↔right and the blob
 * breathes; idle shows the same palette held still. The transcript fades all
 * but the last few words so the newest speech reads as "live".
 *
 * Positions itself absolutely — render it inside a positioned parent
 * (`MobileFrame` is one).
 */
export function VoiceListeningView({
  listening = false,
  transcript,
  headline = 'Hi, I am listening',
  className,
}: {
  listening?: boolean;
  /** Live speech-to-text. Rendered only while `listening`. */
  transcript?: string;
  headline?: string;
  className?: string;
}) {
  return (
    <div className={clsx('pointer-events-none absolute inset-0', className)}>
      <p
        className={clsx(
          'absolute left-1/2 top-[180px] -translate-x-1/2 whitespace-nowrap',
          'bg-clip-text text-xl font-bold text-transparent',
          listening
            ? 'animate-voice-flow bg-voice-listening bg-flow'
            : 'bg-voice-idle',
        )}
      >
        {headline}
      </p>

      {/* Wrapper owns placement; GradientBlob's inner element owns the pulse. */}
      <div className="absolute left-1/2 top-[220px] h-[310px] w-[311px] -translate-x-1/2">
        <GradientBlob active={listening} className="h-full w-full" />
      </div>

      {listening && transcript && (
        <p className="absolute left-[40px] right-[40px] top-[540px] text-center text-base leading-snug text-gray-100">
          {transcript.split(' ').map((word, i, arr) => {
            const isLastFew = i >= arr.length - 4;
            return (
              <span key={i} className={isLastFew ? 'text-gray-100' : 'text-gray-60'}>
                {word}{' '}
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}
