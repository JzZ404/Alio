import clsx from 'clsx';

/**
 * Two-way (or more) segmented control for the Pending / Confirmed screen.
 * `role="tablist"` + `role="tab"` + `aria-selected` — no `aria-controls`, since
 * there is no separate tabpanel element to point at, just a swapped list below.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" className="flex h-[52px] w-full rounded-full bg-white/50 p-[5px]">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={clsx(
              'flex flex-1 items-center justify-center gap-[8px] rounded-full text-[16px] font-bold',
              selected
                ? 'bg-white text-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.08)]'
                : 'text-gray-60',
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-brand-primary px-[6px] text-[12px] font-bold text-white">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
