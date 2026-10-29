import clsx from 'clsx';

/**
 * Two-way (or more) segmented control for the Pending / Confirmed screen.
 * `role="tablist"` + `role="tab"` + `aria-selected` — no `aria-controls`, since
 * there is no separate tabpanel element to point at, just a swapped list below.
 *
 * The white pill is one element that slides between segments rather than a
 * background that blinks on and off, so switching tabs reads as movement.
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
  const selectedIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === value),
  );

  return (
    <div role="tablist" className="relative flex h-[52px] w-full rounded-full bg-white/50 p-[5px]">
      <span
        aria-hidden
        className="absolute bottom-[5px] left-[5px] top-[5px] rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out"
        style={{
          width: `calc((100% - 10px) / ${tabs.length})`,
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />
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
              'relative z-10 flex flex-1 items-center justify-center gap-[8px] rounded-full text-[16px] font-bold transition-colors duration-200',
              selected ? 'text-gray-100' : 'text-gray-60',
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
