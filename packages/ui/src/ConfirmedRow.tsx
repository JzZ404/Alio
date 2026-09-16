import { IconCheck } from './icons';
import { personLabel } from './messaging/participants';
import { formatMessageTime } from './messaging/pending';
import type { ThreadMessage } from './messaging/types';

/** One row of the Confirmed tab, grouped by day above this component: a check mark, the message, then who and when. */
export function ConfirmedRow({ message }: { message: ThreadMessage }) {
  return (
    <div className="flex gap-[10px] rounded-[16px] bg-white px-[16px] py-[14px]">
      <IconCheck aria-hidden className="mt-[2px] size-[18px] shrink-0 text-brand-primary" />
      <div>
        <p className="text-[15px] leading-snug text-gray-100">{message.text}</p>
        <p className="mt-[4px] text-[12px] text-gray-60">
          {`${personLabel(message.senderId, message.senderName)} · ${formatMessageTime(message.acknowledgedAt ?? message.createdAt)}`}
        </p>
      </div>
    </div>
  );
}
