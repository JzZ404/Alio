import { ChatListItem, IconBox, IconSearch, IconChat } from '@alio/ui';
import { SAMPLE_FM_CHAT_THREADS } from '@alio/mock-data';

/**
 * Family Chat tab — list of conversation threads.
 * Same UI/layout as Caregiver Chat; only the data fixture differs
 * (different contacts: caregiver, family members, doctor).
 */
export default function FamilyChatPage({ onOpenThread }: { onOpenThread?: (id: string) => void } = {}) {
  return (
    <div
      className="relative h-full min-h-screen overflow-hidden sm:h-[852px] sm:min-h-0"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      {/* Top header — "Chat" pill + Search + new-chat icons (top-60 to match other screens) */}
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

      {/* Thread list */}
      <ul className="absolute bottom-[110px] left-[22px] right-[22px] top-[129px] flex flex-col gap-[12px] overflow-y-auto">
        {SAMPLE_FM_CHAT_THREADS.map((thread) => (
          <li key={thread.id}>
            <ChatListItem thread={thread} onOpen={onOpenThread} />
          </li>
        ))}
      </ul>
    </div>
  );
}
