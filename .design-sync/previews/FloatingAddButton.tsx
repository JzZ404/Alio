import { FloatingAddButton } from '@alio/ui';

/** The lime FAB that sits above the tab bar on Family Home. */
export const Default = () => (
  <div style={{ padding: 16 }}>
    <FloatingAddButton aria-label="Add" />
  </div>
);

export const OverContent = () => (
  <div
    style={{
      position: 'relative',
      width: 280,
      height: 150,
      borderRadius: 24,
      background: 'var(--color-gray-30)',
      padding: 12,
    }}
  >
    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-gray-60)' }}>
      Upcoming
    </span>
    <FloatingAddButton
      aria-label="Add appointment"
      className="absolute bottom-4 right-4"
    />
  </div>
);
