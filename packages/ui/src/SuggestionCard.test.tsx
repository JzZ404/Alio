import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SuggestionCard } from './SuggestionCard';

afterEach(cleanup);

describe('SuggestionCard', () => {
  it('explains itself and offers both answers', () => {
    render(<SuggestionCard onMark={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText('ALIO SUGGESTS')).toBeTruthy();
    expect(
      screen.getByText('This one sounds like it needs Sarah. Mark it as Pending so she Confirms it?'),
    ).toBeTruthy();
    expect(screen.getByText('Only you can see this')).toBeTruthy();
  });

  /*
   * The card plays itself out before reporting, so a test has to let that
   * timer run — and the two answers need separate renders now, because the
   * first one puts the card into its leaving state and a leaving card stops
   * accepting answers.
   */
  async function settle() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
  }

  it('reports Mark it once the card has played out', async () => {
    const onMark = vi.fn();
    render(<SuggestionCard onMark={onMark} onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark it' }));
    await settle();
    expect(onMark).toHaveBeenCalled();
  });

  it('reports No need once the card has played out', async () => {
    const onDismiss = vi.fn();
    render(<SuggestionCard onMark={() => {}} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'No need' }));
    await settle();
    expect(onDismiss).toHaveBeenCalled();
  });

  // A second tap while it is leaving must not fire a second answer — the
  // card is on its way out and the first answer is already committed.
  it('ignores a second answer while it is leaving', async () => {
    const onMark = vi.fn();
    const onDismiss = vi.fn();
    render(<SuggestionCard onMark={onMark} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark it' }));
    fireEvent.click(screen.getByRole('button', { name: 'No need' }));
    await settle();
    expect(onMark).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
