import { IconCheck } from './icons';
import { personLabel } from './messaging/participants';
import { formatMessageDate, formatMessageTime } from './messaging/pending';
import type { ThreadMessage } from './messaging/types';

/**
 * One row of the Confirmed tab, grouped by day above this component: a filled
 * check, the message, then who and when.
 *
 * `showDate` is set for every group except TODAY, where the time alone is
 * unambiguous. EARLIER spans several days, so the date belongs on each row
 * rather than on the group heading.
 */
export function ConfirmedRow({
  message,
  showDate = false,
}: {
  message: ThreadMessage;
  showDate?: boolean;
}) {
  const at = message.acknowledgedAt ?? message.createdAt;
  const when = showDate ? `${formatMessageDate(at)} · ${formatMessageTime(at)}` : formatMessageTime(at);

  return (
    <div className="flex items-center gap-[12px] rounded-[16px] bg-white px-[16px] py-[14px]">
      <span
        aria-hidden
        className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-brand-accent"
      >
        <IconCheck className="size-[15px] text-gray-100" />
      </span>
      <div>
        <p className="text-[15px] leading-snug text-gray-100">{message.text}</p>
        <p className="mt-[4px] text-[12px] text-gray-60">
          {`${personLabel(message.senderId, message.senderName)} · ${when}`}
        </p>
      </div>
    </div>
  );
}
