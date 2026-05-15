import { ChatListItem, IconBox, IconSearch, IconChat } from '@alio/ui';
import { SAMPLE_CHAT_THREADS } from '@alio/mock-data';

/**
 * Caregiver Chat tab — list of conversation threads.
 * Figma: `GC - Chat - initial page` (254:2503).
 *
 * Header is positioned at `top-[60px] left-[25px] right-[25px]` to match the
 * "Alio voice" pill position on the Logs screen — keeps the top toolbar
 * height consistent across the app.
 */
export default function CaregiverChatPage({ onOpenThread }: { onOpenThread?: (id: string) => void } = {}) {
  return (
    <div
      className="relative h-full min-h-screen overflow-hidden sm:h-[852px] sm:min-h-0"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      {/* Top header — "Chat" pill + Search + chat-list icons */}
      <header className="absolute left-[25px] right-[25px] top-[60px] z-10 flex items-center justify-between">
        <span className="flex h-[42px] items-center rounded-[10px] bg-brand-tint-1 px-[12px] text-[20px] font-bold text-black">
          Chat
        </span>
        <div className="flex items-center gap-[12px]">
          <IconBox size={42} shape="pill" aria-label="Search chats">
            <IconSearch className="size-[24px] text-gray-100" />
          </IconBox>
          <IconBox size={42} shape="pill" aria-label="New chat">
            <IconChat className="size-[24px] text-gray-100" />
          </IconBox>
        </div>
      </header>

      {/* Thread list — starts at y=129 (just below the 60+42+27 header) */}
      <ul className="absolute bottom-[110px] left-[22px] right-[22px] top-[129px] flex flex-col gap-[12px] overflow-y-auto">
        {SAMPLE_CHAT_THREADS.map((thread) => (
          <li key={thread.id}>
            <ChatListItem thread={thread} onOpen={onOpenThread} />
          </li>
        ))}
      </ul>
    </div>
  );
}
