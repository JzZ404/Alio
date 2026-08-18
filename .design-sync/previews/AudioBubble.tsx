import { AudioBubble } from '@alio/ui';

/**
 * AudioBubble is the caregiver's voice note in the Logs conversation. The
 * chevron expands the transcript inline — both states shown. Transcript text is
 * the real INITIAL_CONVERSATION fixture.
 */
const TRANSCRIPT =
  'I just measured the blood pressure and the results shows normal. Gonna give her her daily medication next.';

const Thread = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      width: 300,
      padding: 12,
      background: 'var(--color-brand-tint-2)',
    }}
  >
    {children}
  </div>
);

export const Collapsed = () => (
  <Thread>
    <AudioBubble time="2:39" transcript={TRANSCRIPT} />
  </Thread>
);

export const TranscriptExpanded = () => (
  <Thread>
    <AudioBubble time="3:02" transcript={TRANSCRIPT} defaultExpanded />
  </Thread>
);
