'use client';

import { useRouter } from 'next/navigation';
import {
  IconBox,
  LogListItem,
  IconArrowLeft,
  IconSearch,
  IconChevronDown,
} from '@alio/ui';
import { LOGS_HISTORY } from '@alio/mock-data';

export default function LogsHistoryPage({ onBack }: { onBack?: () => void } = {}) {
  const router = useRouter();
  const back = onBack ?? (() => router.push('/logs'));
  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #E3E5F1 0%, #EAEAF2 50%, #D3D5EC 100%)',
      }}
    >
      {/* Top header — back / dates / search */}
      <header className="absolute left-[25px] right-[25px] top-[60px] z-10 flex items-center justify-between">
        <IconBox size={42} aria-label="Back" onClick={back}>
          <IconArrowLeft className="size-6 text-gray-100" />
        </IconBox>

        <button
          type="button"
          className="flex h-[42px] items-center gap-2 rounded-[10px] bg-brand-tint-1 px-4"
        >
          <span className="text-md font-bold text-gray-100">Dates</span>
          <IconChevronDown className="size-4 text-gray-100" />
        </button>

        <IconBox size={42} aria-label="Search history">
          <IconSearch className="size-6 text-gray-100" />
        </IconBox>
      </header>

      {/* List */}
      <div className="absolute bottom-[110px] left-0 right-0 top-[128px] overflow-y-auto px-5 py-3">
        <ul className="flex flex-col gap-2.5">
          {LOGS_HISTORY.map((item) => (
            <li key={item.id}>
              <LogListItem name={item.patientName} date={item.date} href={`/logs/history/${item.id}`} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
