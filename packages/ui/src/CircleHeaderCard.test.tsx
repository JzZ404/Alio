import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CircleHeaderCard } from './CircleHeaderCard';

afterEach(cleanup);

const avatars = ['/avatars/nurse.png', '/avatars/janet.jpg'];

describe('CircleHeaderCard', () => {
  it('names the circle and its primary member', () => {
    render(
      <CircleHeaderCard
        name="Sarah Lee"
        subtitle="Caregiver · Erin's circle"
        avatars={avatars}
        markedCount={0}
        onSeeAll={() => {}}
        onAdd={() => {}}
      />,
    );
    expect(screen.getByText('Sarah Lee')).toBeTruthy();
    expect(screen.getByText("Caregiver · Erin's circle")).toBeTruthy();
  });

  it('stays quiet when nothing is marked', () => {
    render(
      <CircleHeaderCard
        name="Sarah Lee"
        subtitle="Caregiver · Erin's circle"
        avatars={avatars}
        markedCount={0}
        onSeeAll={() => {}}
        onAdd={() => {}}
      />,
    );
    expect(screen.queryByText(/waiting on Sarah/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'See all' })).toBeNull();
  });

  it('counts what is waiting, singular and plural, and reports See all', () => {
    const onSeeAll = vi.fn();
    const { rerender } = render(
      <CircleHeaderCard
        name="Sarah Lee"
        subtitle="Caregiver · Erin's circle"
        avatars={avatars}
        markedCount={1}
        onSeeAll={onSeeAll}
        onAdd={() => {}}
      />,
    );
    expect(screen.getByText('1 marked, waiting on Sarah')).toBeTruthy();
    rerender(
      <CircleHeaderCard
        name="Sarah Lee"
        subtitle="Caregiver · Erin's circle"
        avatars={avatars}
        markedCount={2}
        onSeeAll={onSeeAll}
        onAdd={() => {}}
      />,
    );
    expect(screen.getByText('2 marked, waiting on Sarah')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'See all' }));
    expect(onSeeAll).toHaveBeenCalled();
  });
});
