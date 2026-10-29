/**
 * One of the two Inbox summary cards (Figma: `GC - Chat - initial page`) —
 * "Pending" and "Confirmed", always shown side by side above the thread list,
 * even at a zero count. `detail` renders as an empty string rather than being
 * omitted so both cards keep the same height when one has no detail line.
 */
export function InboxSummaryCard({
  count,
  label,
  detail,
  onOpen,
}: {
  count: number;
  label: string;
  detail: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex-1 rounded-[14px] bg-brand-primary px-[14px] py-[12px] text-left text-white transition-colors active:bg-brand-active"
    >
      <span className="block text-[28px] font-bold leading-none">{count}</span>
      <span className="mt-[6px] block text-[14px] font-bold leading-none">{label}</span>
      <span className="mt-[6px] block text-[12px] leading-none text-white/80">{detail ?? ''}</span>
    </button>
  );
}
