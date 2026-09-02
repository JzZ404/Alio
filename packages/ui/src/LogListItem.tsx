import Link from 'next/link';
import { IconMedicalRecord } from './icons';

const ROW =
  'flex w-full items-center justify-between rounded-2xl bg-white/60 px-4 py-3 text-left shadow-sm transition-colors active:bg-white/80';

/**
 * LogListItem — row in a history list (caregiver Logs, family AI chats).
 * Card with a title, date/time, and clipboard icon button on the right.
 *
 * Pass `onClick` when the row opens a subPage inside the tab shell, or `href`
 * when it should navigate. `onClick` wins if both are given.
 */
export function LogListItem({
  name,
  date,
  href = '#',
  onClick,
}: {
  name: string;
  date: string;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex flex-col gap-[6px]">
        <span className="text-[20px] leading-[25px] font-normal text-gray-100">{name}</span>
        <span className="text-[14px] leading-[17px] text-gray-60 tabular-nums">{date}</span>
      </div>
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-tint-1">
        <IconMedicalRecord className="size-5 text-gray-100" />
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={ROW}>
        {body}
      </button>
    );
  }

  return (
    <Link href={href} className={ROW}>
      {body}
    </Link>
  );
}
