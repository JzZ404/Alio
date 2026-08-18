import { ChatBubble } from '@alio/ui';

/**
 * ChatBubble renders one message. `me` is right-aligned on brand-primary;
 * `them` is left-aligned on white. Text is from the real family chat fixtures.
 *
 * The image variant uses an inline data-URI photo stand-in — the app serves
 * attachments from /public, which does not exist outside the Next apps.
 */
const PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EDEDFC"/><stop offset="1" stop-color="#D3D5EC"/></linearGradient></defs><rect width="240" height="140" fill="url(#g)"/><circle cx="120" cy="60" r="26" fill="#9E9E9E" opacity="0.55"/><rect x="60" y="96" width="120" height="10" rx="5" fill="#9E9E9E" opacity="0.45"/></svg>`,
  );

const Thread = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-[320px] flex-col gap-2 rounded-2xl bg-gray-30 p-3">{children}</div>
);

export const FromThem = () => (
  <Thread>
    <ChatBubble
      message={{
        id: 'm1',
        sender: 'them',
        text: 'Just finished morning meds, all good!',
      }}
    />
  </Thread>
);

export const FromMe = () => (
  <Thread>
    <ChatBubble
      message={{
        id: 'm2',
        sender: 'me',
        text: 'Thank you Sarah — did she eat breakfast today?',
      }}
    />
  </Thread>
);

export const WithImage = () => (
  <Thread>
    <ChatBubble
      message={{
        id: 'm3',
        sender: 'me',
        text: 'Dorothy seems to have some side effect on the drugs',
        imageUrl: PHOTO,
      }}
    />
  </Thread>
);

export const Conversation = () => (
  <Thread>
    <ChatBubble
      message={{ id: 'c1', sender: 'me', text: 'How was her blood pressure this morning?' }}
    />
    <ChatBubble
      message={{
        id: 'c2',
        sender: 'them',
        text: '128 over 78 — right in her normal range. She slept well too.',
      }}
    />
    <ChatBubble message={{ id: 'c3', sender: 'me', text: 'That is a relief. Thank you!' }} />
  </Thread>
);
