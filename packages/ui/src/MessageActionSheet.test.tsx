import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MessageActionSheet } from './MessageActionSheet';
import type { ThreadMessage } from './messaging/types';

afterEach(cleanup);

const mine: ThreadMessage = {
  id: 'm1',
  threadId: 'caregiver-001__erin-yeung',
  senderId: 'janet-chen',
  recipientId: 'caregiver-001',
  senderName: 'Janet Chen',
  text: 'Please pick up her prescription on your way today — order 4471.',
  reportId: null,
  finalTier: null,
  acknowledgedAt: null,
  createdAt: '2026-09-16T09:00:00Z',
};

// The real app only ever opens the sheet for the viewer's own message, so
// tests mirror that: `viewerId` always matches `mine.senderId`.
const viewerId = mine.senderId as string;

const anchor = { top: 140, left: 32, width: 210 };

/**
 * jsdom never computes real layout, so `clientHeight`/`offsetHeight` are
 * always 0 — which silently forces the "fits below" branch on every render
 * and would leave the above/below flip (and the no-overlap guarantee)
 * untested. These fake specific elements' rendered size by `data-testid`,
 * restoring the real accessors afterward. Patched on whichever prototype in
 * the chain actually owns the property, since that varies by environment.
 */
function mockLayoutSizes(sizes: Record<string, number>) {
  const props = ['clientHeight', 'offsetHeight'] as const;
  const restore = props.map((prop) => {
    let owner: object | null = HTMLElement.prototype;
    while (owner && !Object.getOwnPropertyDescriptor(owner, prop)) {
      owner = Object.getPrototypeOf(owner);
    }
    if (!owner) throw new Error(`No owner found for property ${prop}`);
    const original = Object.getOwnPropertyDescriptor(owner, prop)!;
    Object.defineProperty(owner, prop, {
      configurable: true,
      get(this: HTMLElement) {
        const key = this.dataset.testid;
        return key !== undefined && key in sizes ? sizes[key] : 0;
      },
    });
    return () => Object.defineProperty(owner as object, prop, original);
  });
  return () => restore.forEach((fn) => fn());
}

/**
 * Both of these play an exit animation before reporting the answer, so a test
 * that asserts immediately after the click sees nothing. Advancing real
 * timers rather than faking them keeps the component's own matchMedia check
 * honest.
 */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
}

describe('MessageActionSheet', () => {
  it('renders nothing when no message is held', () => {
    const { container } = render(
      <MessageActionSheet
        message={null}
        anchor={anchor}
        viewerId={viewerId}
        onMarkPending={() => {}}
        onUnmarkPending={() => {}}
        onReply={() => {}}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when anchor is null, even with no message', () => {
    const { container } = render(
      <MessageActionSheet
        message={null}
        anchor={null}
        viewerId={viewerId}
        onMarkPending={() => {}}
        onUnmarkPending={() => {}}
        onReply={() => {}}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('offers the three actions, with the message and the reassurance', () => {
    render(
      <MessageActionSheet
        message={mine}
        anchor={anchor}
        viewerId={viewerId}
        onMarkPending={() => {}}
        onUnmarkPending={() => {}}
        onReply={() => {}}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(mine.text)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark as Pending' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reply' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy text' })).toBeTruthy();
    expect(screen.getByText('Sarah Confirms it when she sees it')).toBeTruthy();
  });

  it('positions the lifted message at the anchor rather than centering it', () => {
    render(
      <MessageActionSheet
        message={mine}
        anchor={anchor}
        viewerId={viewerId}
        onMarkPending={() => {}}
        onUnmarkPending={() => {}}
        onReply={() => {}}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    const lifted = screen.getByTestId('lifted-message');
    expect(lifted.style.top).toBe(`${anchor.top}px`);
    expect(lifted.style.left).toBe(`${anchor.left}px`);
    expect(lifted.style.width).toBe(`${anchor.width}px`);
  });

  it('lifts the real MessageBubble rather than a hand-rolled copy', () => {
    render(
      <MessageActionSheet
        message={{ ...mine, finalTier: 'action' }}
        anchor={anchor}
        viewerId={viewerId}
        onMarkPending={() => {}}
        onUnmarkPending={() => {}}
        onReply={() => {}}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    const lifted = screen.getByTestId('lifted-message');
    // `data-message-id` and the `lifted` width class are both written by
    // MessageBubble itself, so a hand-rolled copy would fail this. Pinning
    // markup the component owns is the point: the two can never drift,
    // whatever the bubble's design does next.
    const bubble = lifted.querySelector(`[data-message-id="${mine.id}"]`);
    expect(bubble).not.toBeNull();
    expect(bubble?.firstElementChild?.className).toContain('w-full');
    expect(lifted.textContent).toContain(mine.text);
  });

  // The status line lives under the bubble and the lift is only as wide as
  // the bubble, so it would wrap; the menu below already says what can be
  // done with the message.
  it('leaves the status line out of the lifted copy', () => {
    render(
      <MessageActionSheet
        message={{ ...mine, finalTier: 'action' }}
        anchor={anchor}
        viewerId={viewerId}
        onMarkPending={() => {}}
        onUnmarkPending={() => {}}
        onReply={() => {}}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId('lifted-message').textContent).not.toContain('Pending');
  });

  /*
   * One action per render: the sheet plays itself out when anything dismisses
   * it, and a sheet that is leaving stops accepting taps — so a second action
   * on the same instance is correctly ignored (see the test below).
   */
  function renderSheet(props: Partial<Parameters<typeof MessageActionSheet>[0]> = {}) {
    return render(
      <MessageActionSheet
        message={mine}
        anchor={anchor}
        viewerId={viewerId}
        onMarkPending={() => {}}
        onUnmarkPending={() => {}}
        onReply={() => {}}
        onCopy={() => {}}
        onClose={() => {}}
        {...props}
      />,
    );
  }

  it('reports Mark as Pending once the menu has played out', async () => {
    const onMarkPending = vi.fn();
    renderSheet({ onMarkPending });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Pending' }));
    await settle();
    expect(onMarkPending).toHaveBeenCalledWith(mine);
  });

  it('reports Copy text once the menu has played out', async () => {
    const onCopy = vi.fn();
    renderSheet({ onCopy });
    fireEvent.click(screen.getByRole('button', { name: 'Copy text' }));
    await settle();
    expect(onCopy).toHaveBeenCalledWith(mine);
  });

  it('closes on the backdrop', async () => {
    const onClose = vi.fn();
    renderSheet({ onClose });
    fireEvent.click(screen.getByLabelText('Close'));
    await settle();
    expect(onClose).toHaveBeenCalled();
  });

  // The exit is short, but a double-tap inside it must not fire two actions —
  // marking and then copying, say, from one gesture.
  it('takes one action per opening, not one per tap', async () => {
    const onMarkPending = vi.fn();
    const onCopy = vi.fn();
    renderSheet({ onMarkPending, onCopy });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Pending' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy text' }));
    await settle();
    expect(onMarkPending).toHaveBeenCalledTimes(1);
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('hides Mark as Pending once the message is already marked', () => {
    render(
      <MessageActionSheet
        message={{ ...mine, finalTier: 'action' }}
        anchor={anchor}
        viewerId={viewerId}
        onMarkPending={() => {}}
        onUnmarkPending={() => {}}
        onReply={() => {}}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Mark as Pending' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy text' })).toBeTruthy();
  });

  it('flips the menu above the message when it would not fit below', () => {
    const restore = mockLayoutSizes({
      'action-sheet-overlay': 400,
      'lifted-message': 60,
      'action-sheet-menu-block': 200,
    });
    try {
      render(
        <MessageActionSheet
          // Near the bottom of a 400-tall frame: below = 300+60+10=370,
          // +200 menu = 570, past 400-12=388 — doesn't fit below.
          message={mine}
          anchor={{ top: 300, left: 32, width: 210 }}
          viewerId={viewerId}
          onMarkPending={() => {}}
          onUnmarkPending={() => {}}
          onReply={() => {}}
          onCopy={() => {}}
          onClose={() => {}}
        />,
      );
      const menuBlock = screen.getByTestId('action-sheet-menu-block');
      expect(menuBlock.style.top).toBe(`${300 - 200 - 10}px`);
    } finally {
      restore();
    }
  });

  it('never overlaps the lifted copy, even for a tall message near the top of a short frame', () => {
    const restore = mockLayoutSizes({
      // A short frame with an intrinsically very tall message (well past
      // the 40% cap) and a sizeable menu — the exact combination that could
      // previously clamp the menu on top of an "unclamped" lifted copy.
      'action-sheet-overlay': 300,
      'lifted-message': 500,
      'action-sheet-menu-block': 150,
    });
    try {
      render(
        <MessageActionSheet
          message={mine}
          anchor={{ top: 10, left: 32, width: 210 }}
          viewerId={viewerId}
          onMarkPending={() => {}}
          onUnmarkPending={() => {}}
          onReply={() => {}}
          onCopy={() => {}}
          onClose={() => {}}
        />,
      );
      const lifted = screen.getByTestId('lifted-message');
      const menuBlock = screen.getByTestId('action-sheet-menu-block');
      // The copy's rendered height is capped to 40% of the 300px frame (120px),
      // not its intrinsic 500px, so its bottom is 10 + 120 = 130.
      expect(lifted.style.maxHeight).toBe(`${300 * 0.4}px`);
      const copyBottom = 10 + 300 * 0.4;
      const menuTop = Number(menuBlock.style.top.replace('px', ''));
      expect(menuTop).toBeGreaterThanOrEqual(copyBottom);
    } finally {
      restore();
    }
  });

  it('reports the message when Reply is tapped, so the composer can quote it', async () => {
    const onReply = vi.fn();
    render(
      <MessageActionSheet
        message={mine}
        anchor={{ top: 100, left: 40, width: 200 }}
        viewerId={viewerId}
        onMarkPending={() => {}}
        onUnmarkPending={() => {}}
        onReply={onReply}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    await settle();
    expect(onReply).toHaveBeenCalledWith(mine);
  });

  /*
   * A long-press is easy to hit by accident, so the menu that marks a message
   * is where it is taken back. It stops being offered once Sarah has
   * Confirmed: she has acted on it, and the database has no transition that
   * un-marks a confirmed message either.
   */
  it('offers Unmark on a marked message, and only while it is unconfirmed', async () => {
    const onUnmarkPending = vi.fn();
    const marked = { ...mine, finalTier: 'action' as const };
    render(
      <MessageActionSheet
        message={marked}
        anchor={{ top: 100, left: 40, width: 200 }}
        viewerId={viewerId}
        onMarkPending={() => {}}
        onUnmarkPending={onUnmarkPending}
        onReply={() => {}}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Mark as Pending' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unmark as Pending' }));
    await settle();
    expect(onUnmarkPending).toHaveBeenCalledWith(marked);
    cleanup();

    render(
      <MessageActionSheet
        message={{ ...marked, acknowledgedAt: '2026-09-15T10:00:00Z' }}
        anchor={{ top: 100, left: 40, width: 200 }}
        viewerId={viewerId}
        onMarkPending={() => {}}
        onUnmarkPending={() => {}}
        onReply={() => {}}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Unmark as Pending' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark as Pending' })).toBeNull();
  });

  // An untagged message has nothing to take back.
  it('does not offer Unmark on a message that was never marked', () => {
    render(
      <MessageActionSheet
        message={mine}
        anchor={{ top: 100, left: 40, width: 200 }}
        viewerId={viewerId}
        onMarkPending={() => {}}
        onUnmarkPending={() => {}}
        onReply={() => {}}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Mark as Pending' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Unmark as Pending' })).toBeNull();
  });
});
