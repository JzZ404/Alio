import Link from 'next/link';
import { IconMedicalRecord } from './icons';

/**
 * LogListItem — row in the Caregiver Logs history list.
 * Card with patient name, date/time, and clipboard icon button on the right.
 */
export function LogListItem({
  name,
  date,
  href = '#',
}: {
  name: string;
  date: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3 shadow-sm transition-colors active:bg-white/80"
    >
      <div className="flex flex-col gap-[6px]">
        <span className="text-[20px] leading-[25px] font-normal text-gray-100">{name}</span>
        <span className="text-[14px] leading-[17px] text-gray-60 tabular-nums">{date}</span>
      </div>
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-tint-1">
        <IconMedicalRecord className="size-5 text-gray-100" />
      </span>
    </Link>
  );
}
