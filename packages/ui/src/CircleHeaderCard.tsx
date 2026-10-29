import { CircleAvatars } from './CircleAvatars';
import { IconPinFilled, IconPlus } from './icons';

/**
 * Header card for the family Chat tab, now the Care Circle itself rather
 * than a list of threads: the circle's identity up top, and — only while
 * something is waiting — a pinned row surfacing how much and a way to jump
 * straight to it.
 */
export function CircleHeaderCard({
  name,
  subtitle,
  avatars,
  markedCount,
  onSeeAll,
  onAdd,
}: {
  name: string;
  subtitle: string;
  avatars: string[];
  markedCount: number;
  onSeeAll: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-[20px] bg-white px-[16px] py-[14px]">
      <div className="flex items-center gap-[12px]">
        <CircleAvatars srcs={avatars} />
        <div>
          <p className="text-[18px] font-bold leading-tight text-gray-100">{name}</p>
          <p className="mt-[2px] text-[13px] leading-none text-gray-60">{subtitle}</p>
        </div>
        {/*
         * Adding someone to a circle is unspecified — this button is a
         * placeholder the design asks to show, the same way `Reply` sits
         * inert in the message action sheet. `onAdd` is wired for when that
         * flow exists.
         */}
        <button
          type="button"
          aria-label="Add to circle"
          onClick={onAdd}
          className="ml-auto flex size-[40px] shrink-0 items-center justify-center rounded-full bg-brand-tint-1"
        >
          <IconPlus className="size-[20px] text-gray-100" />
        </button>
      </div>

      {markedCount > 0 && (
        <div className="mt-[12px] flex items-center gap-[10px] rounded-[14px] bg-brand-tint-1 px-[12px] py-[10px]">
          <IconPinFilled className="size-[18px] shrink-0 text-brand-primary" />
          <span className="flex-1 text-[14px] font-bold text-gray-100">
            {markedCount} marked, waiting on Sarah
          </span>
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[14px] font-bold text-brand-primary"
          >
            See all
          </button>
        </div>
      )}
    </div>
  );
}
