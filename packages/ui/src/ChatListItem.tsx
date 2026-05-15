import Link from 'next/link';
import { IconPinFilled } from './icons';
import type { ChatThread } from '@alio/mock-data';

const SUBTITLE_GRAY = '#A8A8A8';

/**
 * ChatListItem — single row on the Caregiver Chat list page.
 * Matches Figma `GC - Chat - initial page` (254:2503).
 *
 * Card: bg #EDEDFC (brand-tint-1), rounded-12, h=72, pl-12 pr-16 py-8.
 * Name: 14px Regular black + optional pin icon.
 * Subtitle: 12px Regular #A8A8A8 (typing variant uses brand-primary).
 * Timestamp: 12px Regular #A8A8A8 (top-right).
 * Unread badge: 17×17 brand-primary circle, 12px white text.
 *
 * Avatars:
 *   - 1:1 thread → single round image at 50px
 *   - Group thread → 3 overlapping faces (~28px each) clustered
 */
export function ChatListItem({ thread, onOpen }: { thread: ChatThread; onOpen?: (id: string) => void }) {
  const subtitleColor = thread.isTyping ? '#5E69F6' : SUBTITLE_GRAY;
  const className = "w-full relative flex h-[72px] items-center gap-[16px] overflow-hidden rounded-[12px] bg-brand-tint-1 pb-[8px] pl-[12px] pr-[16px] pt-[8px] transition-colors active:bg-brand-border/50";
  const inner = (<>
      <Avatar
        isGroup={thread.isGroup}
        hasStatus={thread.status === 'online'}
        src={thread.avatarUrl}
        groupSrcs={thread.groupAvatars}
        name={thread.name}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
        <div className="flex items-center gap-[4px]">
          <span className="truncate text-[14px] text-black">{thread.name}</span>
          {thread.pinned && (
            <IconPinFilled className="size-[12px] shrink-0 text-brand-primary" />
          )}
        </div>
        <span className="truncate text-[12px] leading-none" style={{ color: subtitleColor }}>
          {thread.lastMessage}
        </span>
      </div>
      <div className="flex h-[43px] w-[50px] shrink-0 flex-col items-end justify-between">
        <span className="text-[12px] leading-none tabular-nums" style={{ color: SUBTITLE_GRAY }}>
          {thread.timestamp}
        </span>
        {thread.unreadCount > 0 && (
          <span className="flex size-[17px] items-center justify-center rounded-full bg-brand-primary text-[12px] leading-none text-white">
            {thread.unreadCount}
          </span>
        )}
      </div>
  </>);

  if (onOpen) {
    return <button type="button" onClick={() => onOpen(thread.id)} className={className}>{inner}</button>;
  }
  return <Link href={`/chat/${thread.id}`} className={className}>{inner}</Link>;
}

/**
 * Avatar — handles three cases:
 *  1) Group with `groupSrcs` → 3 overlapping mini-photos
 *  2) Single `src` → one 50px round photo
 *  3) Neither → gray placeholder (group glyph or solo circle)
 */
function Avatar({
  src,
  groupSrcs,
  name,
  isGroup,
  hasStatus,
}: {
  src?: string;
  groupSrcs?: string[];
  name: string;
  isGroup?: boolean;
  hasStatus?: boolean;
}) {
  const SIZE = 50;

  // Group cluster — overlapping faces
  if (isGroup && groupSrcs && groupSrcs.length > 0) {
    const faces = groupSrcs.slice(0, 3);
    return (
      <span
        className="relative shrink-0"
        style={{ width: SIZE, height: SIZE }}
      >
        {/* Top-left */}
        {faces[0] && (
          <GroupFace src={faces[0]} alt={`${name} member 1`} className="absolute left-0 top-0 size-[28px]" />
        )}
        {/* Bottom-middle */}
        {faces[1] && (
          <GroupFace src={faces[1]} alt={`${name} member 2`} className="absolute bottom-0 left-[8px] size-[24px]" />
        )}
        {/* Top-right / overlapping */}
        {faces[2] && (
          <GroupFace src={faces[2]} alt={`${name} member 3`} className="absolute bottom-[2px] right-0 size-[28px]" />
        )}
        {hasStatus && (
          <span className="absolute bottom-0 right-0 size-[12px] rounded-full border-2 border-brand-tint-1 bg-brand-accent" />
        )}
      </span>
    );
  }

  // 1:1 thread — single photo
  return (
    <span
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          width={SIZE}
          height={SIZE}
          className="size-full rounded-full object-cover"
        />
      ) : (
        <span className="size-full rounded-full bg-gray-30" />
      )}
      {hasStatus && (
        <span className="absolute bottom-0 right-0 size-[12px] rounded-full border-2 border-brand-tint-1 bg-brand-accent" />
      )}
    </span>
  );
}

function GroupFace({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`${className ?? ''} rounded-full border-[1.5px] border-brand-tint-1 object-cover`}
    />
  );
}
