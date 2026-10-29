import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CircleAvatars } from './CircleAvatars';

afterEach(cleanup);

describe('CircleAvatars', () => {
  it('renders one image per member', () => {
    render(<CircleAvatars srcs={['/avatars/nurse.png', '/avatars/janet.jpg', '/avatars/elder1.png']} />);
    expect(screen.getAllByRole('presentation')).toHaveLength(3);
  });

  it('caps at three so the cluster stays legible', () => {
    render(
      <CircleAvatars
        srcs={['/a.png', '/b.png', '/c.png', '/d.png', '/e.png']}
      />,
    );
    expect(screen.getAllByRole('presentation')).toHaveLength(3);
  });

  it('renders nothing when the circle is empty', () => {
    const { container } = render(<CircleAvatars srcs={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
