import clsx from 'clsx';
import { IconAttention } from './icons';
import type { ThreadMessage } from './messaging/types';

/**
 * A live chat message. The primary Pending surface (spec §2.3): a
 * "Needs response" message carries its Confirm button in the bubble, and both
 * sides see the state — the recipient gets Confirm, the sender sees Pending,
 * everyone sees Confirmed.
 *
 * Confirm renders only when `onConfirm` is passed, so a screen that cannot
 * confirm never shows a dead button.
 */
export function MessageBubble({
  message,
  viewerId,
  onConfirm,
  highlighted = false,
}: {
  message: ThreadMessage;
  viewerId: string;
  onConfirm?: (messageId: string) => void;
  highlighted?: boolean;
}) {
  const isMine = message.senderId === viewerId;
  const needsResponse = message.finalTier === 'action';
  const confirmed = message.acknowledgedAt !== null;
  const canConfirm =
    onConfirm !== undefined && needsResponse && !confirmed && message.recipientId === viewerId;

  return (
    <div
      data-message-id={message.id}
      className={clsx('flex', isMine ? 'justify-end' : 'justify-start')}
    >
      <div
        className={clsx(
          'max-w-[75%] rounded-[20px] px-[14px] py-[12px] transition-shadow duration-300',
          isMine ? 'rounded-tr-[6px]' : 'rounded-tl-[6px]',
          needsResponse
            ? 'border border-attention-border bg-attention-surface text-attention-text'
            : isMine
              ? 'bg-brand-primary text-white'
              : 'bg-white text-gray-100',
          // Jumped-to from the Pending list: brand accent, thick enough to
          // register — the accent green is only 1.3:1 against these surfaces.
          highlighted && 'ring-[3px] ring-brand-accent ring-offset-2',
        )}
      >
        {needsResponse && (
          <p className="mb-[6px] flex items-center gap-[6px] text-[12px] font-bold">
            <IconAttention aria-hidden className="size-[16px] text-brand-primary" />
            Needs response
          </p>
        )}
        <p className="whitespace-pre-wrap text-[14px] leading-snug">{message.text}</p>
        {canConfirm && (
          <button
            type="button"
            onClick={() => onConfirm?.(message.id)}
            // brand-active, not brand-primary: white on primary is 4.35:1 and
            // misses AA; on active it is 5.18:1.
            className="mt-[10px] h-[38px] w-full rounded-lg bg-brand-active text-[14px] font-bold text-white transition-colors active:bg-brand-primary"
          >
            Confirm
          </button>
        )}
        {needsResponse && !canConfirm && (
          <p className="mt-[8px] text-[12px] font-bold">{confirmed ? 'Confirmed' : 'Pending'}</p>
        )}
      </div>
    </div>
  );
}
