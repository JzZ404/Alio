import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PendingCard } from './PendingCard';
import { ConfirmedRow } from './ConfirmedRow';
import { SegmentedTabs } from './SegmentedTabs';
import type { ThreadMessage } from './messaging/types';

afterEach(cleanup);

const NOW = new Date('2026-09-15T12:00:00Z');
const LONG_TEXT =
  'Could you check whether she still has enough of the blue blood pressure pills? ' +
  "I'll order more tonight if she's low, and I can drop them off on Thursday.";

const pending: ThreadMessage = {
  id: 'm1',
  threadId: 'caregiver-001__erin-yeung',
  senderId: 'emily-chen',
  recipientId: 'caregiver-001',
  senderName: 'Emily',
  text: LONG_TEXT,
  reportId: null,
  finalTier: 'action',
  acknowledgedAt: null,
  createdAt: '2026-09-15T11:20:00Z',
};

describe('PendingCard', () => {
  it('shows sender with relationship, the waiting pill and the full text', () => {
    render(<PendingCard message={pending} now={NOW} onOpen={() => {}} onConfirm={() => {}} />);
    expect(screen.getByText('Emily · Granddaughter')).toBeTruthy();
    expect(screen.getByText('Waiting 40m')).toBeTruthy();
    expect(screen.getByText(LONG_TEXT)).toBeTruthy();
  });

  it('confirms from the button and opens the thread from the body', () => {
    const onConfirm = vi.fn();
    const onOpen = vi.fn();
    render(<PendingCard message={pending} now={NOW} onOpen={onOpen} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledWith('m1');
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(LONG_TEXT));
    expect(onOpen).toHaveBeenCalledWith(pending);
  });

  it('exposes the card body as a button so it works without a pointer', () => {
    const onOpen = vi.fn();
    render(<PendingCard message={pending} now={NOW} onOpen={onOpen} onConfirm={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toContain('Confirm');
    const body = buttons.find((b) => b.textContent?.includes(LONG_TEXT));
    expect(body).toBeTruthy();
    fireEvent.click(body!);
    expect(onOpen).toHaveBeenCalledWith(pending);
  });
});

describe('ConfirmedRow', () => {
  it('reads as one line: message, then who and when', () => {
    render(
      <ConfirmedRow
        message={{ ...pending, acknowledgedAt: '2026-09-15T09:14:00Z' }}
      />,
    );
    expect(screen.getByText(LONG_TEXT)).toBeTruthy();
    expect(screen.getByText(/Emily · Granddaughter ·/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
  });
});

describe('ConfirmedRow dates', () => {
  it('shows only the time for today, and the date too for older rows', () => {
    const confirmed = { ...pending, acknowledgedAt: '2026-09-14T16:41:00Z' };
    const { container: today } = render(<ConfirmedRow message={confirmed} />);
    expect(today.textContent).not.toMatch(/Sep 14/);
    cleanup();
    const { container: older } = render(<ConfirmedRow message={confirmed} showDate />);
    expect(older.textContent).toMatch(/Sep 14/);
  });
});

describe('SegmentedTabs', () => {
  it('marks the selected tab, shows a badge and reports a change', () => {
    const onChange = vi.fn();
    render(
      <SegmentedTabs
        tabs={[
          { value: 'pending', label: 'Pending', badge: 3 },
          { value: 'confirmed', label: 'Confirmed' },
        ]}
        value="pending"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('tab', { name: /Pending/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('3')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Confirmed' }));
    expect(onChange).toHaveBeenCalledWith('confirmed');
  });

  it('hides a zero badge', () => {
    render(
      <SegmentedTabs
        tabs={[
          { value: 'pending', label: 'Pending', badge: 0 },
          { value: 'confirmed', label: 'Confirmed' },
        ]}
        value="confirmed"
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText('0')).toBeNull();
  });
});
