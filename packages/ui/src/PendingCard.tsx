import clsx from 'clsx';
import { personLabel } from './messaging/participants';
import { waitingLabel } from './messaging/pending';
import type { ThreadMessage } from './messaging/types';

/**
 * One row of the Pending tab: sender + relationship, how long it's waited,
 * the full ask and Confirm. The message is never truncated — acting on it
 * needs the whole text, not a "read more" round trip.
 *
 * Tapping the body (sender row + message) opens the thread; tapping Confirm
 * does not, so the two live in separate click targets rather than one
 * handler that has to guess what was tapped.
 */
export function PendingCard({
  message,
  now,
  onConfirm,
  onOpen,
  leaving = false,
}: {
  message: ThreadMessage;
  now: Date;
  onConfirm: (messageId: string) => void;
  onOpen: (message: ThreadMessage) => void;
  leaving?: boolean;
}) {
  return (
    <div
      className={clsx(
        'rounded-[16px] bg-white px-[16px] py-[16px] transition-[transform,opacity] duration-300',
        leaving && 'translate-x-6 opacity-0',
      )}
    >
      <button type="button" onClick={() => onOpen(message)} className="block w-full text-left">
        <span className="flex items-center justify-between">
          <span className="text-[15px] font-bold text-gray-100">
            {personLabel(message.senderId, message.senderName)}
          </span>
          <span className="rounded-full bg-brand-tint-1 px-[10px] py-[4px] text-[12px] font-bold text-brand-primary">
            {waitingLabel(message.createdAt, now)}
          </span>
        </span>
        <span className="mt-[12px] block whitespace-pre-wrap text-[16px] leading-[1.45] text-gray-100">
          {message.text}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onConfirm(message.id)}
        // brand-active, not brand-primary: white on primary is 4.35:1 and
        // misses AA; on active it is 5.18:1.
        className="mt-[16px] h-[48px] w-full rounded-[12px] bg-brand-active text-[16px] font-bold text-white transition-colors active:bg-brand-primary"
      >
        Confirm
      </button>
    </div>
  );
}
