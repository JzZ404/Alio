import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InboxSummaryCard } from './InboxSummaryCard';

afterEach(cleanup);

describe('InboxSummaryCard', () => {
  it('shows the count, label and detail, and reports taps', () => {
    const onOpen = vi.fn();
    render(
      <InboxSummaryCard count={2} label="Pending" detail="Waiting since 9:14 AM" onOpen={onOpen} />,
    );
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Waiting since 9:14 AM')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Pending/ }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('still renders at zero', () => {
    render(<InboxSummaryCard count={0} label="Pending" detail={null} onOpen={() => {}} />);
    expect(screen.getByText('0')).toBeTruthy();
  });
});
