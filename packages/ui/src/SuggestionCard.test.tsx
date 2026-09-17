import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('reports which answer was given', () => {
    const onMark = vi.fn();
    const onDismiss = vi.fn();
    render(<SuggestionCard onMark={onMark} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark it' }));
    expect(onMark).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'No need' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
