import { ChatListItem } from '@alio/ui';

/**
 * ChatListItem is a row on the Chat list: avatar, name (with optional pin),
 * last message, timestamp, and unread badge. Group threads stack three faces.
 * Content is the real SAMPLE_FM_CHAT_THREADS fixture set.
 */
const avatar = (bg: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${bg}"/><circle cx="32" cy="25" r="12" fill="#9E9E9E"/><path d="M6 64c0-14 12-21 26-21s26 7 26 21z" fill="#9E9E9E"/></svg>`,
  );

const List = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 360, padding: 12 }}>
    {children}
  </div>
);

export const ThreadList = () => (
  <List>
    <ChatListItem
      thread={{
        id: 'sarah-caregiver',
        name: 'Sarah Mitchell',
        lastMessage: 'Just finished morning meds, all good!',
        timestamp: '11:24AM',
        unreadCount: 1,
        pinned: true,
        status: 'online',
        avatarUrl: avatar('#EDEDFC'),
      }}
    />
    <ChatListItem
      thread={{
        id: 'care-circle',
        name: "Dorothy's care circle",
        lastMessage: 'Janet: I can take Thursday afternoon.',
        timestamp: '9:02AM',
        unreadCount: 3,
        isGroup: true,
        groupAvatars: [avatar('#EDEDFC'), avatar('#EAEAF2'), avatar('#D3D5EC')],
      }}
    />
    <ChatListItem
      thread={{
        id: 'dr-rowan',
        name: 'Dr. Rowan',
        lastMessage: 'Typing…',
        timestamp: 'Yesterday',
        unreadCount: 0,
        isTyping: true,
        avatarUrl: avatar('#EAEAF2'),
      }}
    />
  </List>
);

export const UnreadAndPinned = () => (
  <List>
    <ChatListItem
      thread={{
        id: 'sarah-caregiver',
        name: 'Sarah Mitchell',
        lastMessage: 'Just finished morning meds, all good!',
        timestamp: '11:24AM',
        unreadCount: 1,
        pinned: true,
        status: 'online',
        avatarUrl: avatar('#EDEDFC'),
      }}
    />
  </List>
);
