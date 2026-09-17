import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('MessageActionSheet', () => {
  it('renders nothing when no message is held', () => {
    const { container } = render(
      <MessageActionSheet
        message={null}
        anchor={anchor}
        viewerId={viewerId}
        onMarkPending={() => {}}
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
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    const lifted = screen.getByTestId('lifted-message');
    expect(lifted.style.top).toBe(`${anchor.top}px`);
    expect(lifted.style.left).toBe(`${anchor.left}px`);
    expect(lifted.style.width).toBe(`${anchor.width}px`);
  });

  it('lifts the real MessageBubble, so an already-marked message keeps its tinted header', () => {
    render(
      <MessageActionSheet
        message={{ ...mine, finalTier: 'action' }}
        anchor={anchor}
        viewerId={viewerId}
        onMarkPending={() => {}}
        onCopy={() => {}}
        onClose={() => {}}
      />,
    );
    const lifted = screen.getByTestId('lifted-message');
    // The Pending header and tinted surface only exist on the real
    // MessageBubble render path — a hand-rolled copy could never show these.
    expect(lifted.textContent).toContain('Pending');
    expect(lifted.querySelector('.bg-attention-surface')).not.toBeNull();
  });

  it('reports the action taken and closes on the backdrop', () => {
    const onMarkPending = vi.fn();
    const onCopy = vi.fn();
    const onClose = vi.fn();
    render(
      <MessageActionSheet
        message={mine}
        anchor={anchor}
        viewerId={viewerId}
        onMarkPending={onMarkPending}
        onCopy={onCopy}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Pending' }));
    expect(onMarkPending).toHaveBeenCalledWith(mine);
    fireEvent.click(screen.getByRole('button', { name: 'Copy text' }));
    expect(onCopy).toHaveBeenCalledWith(mine);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('hides Mark as Pending once the message is already marked', () => {
    render(
      <MessageActionSheet
        message={{ ...mine, finalTier: 'action' }}
        anchor={anchor}
        viewerId={viewerId}
        onMarkPending={() => {}}
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
});
