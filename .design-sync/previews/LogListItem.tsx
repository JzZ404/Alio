import { LogListItem } from '@alio/ui';

/** Rows in the Caregiver Logs history list — one visit log per row. */
const List = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 340, padding: 12, background: 'var(--color-brand-tint-2)' }}>
    {children}
  </div>
);

export const History = () => (
  <List>
    <LogListItem name="Dorothy Chen" date="May 13, 2026 · 9:12 AM" href="#" />
    <LogListItem name="Harold Nguyen" date="May 12, 2026 · 4:40 PM" href="#" />
    <LogListItem name="Dorothy Chen" date="May 12, 2026 · 8:55 AM" href="#" />
  </List>
);

export const SingleEntry = () => (
  <List>
    <LogListItem name="Dorothy Chen" date="May 13, 2026 · 9:12 AM" href="#" />
  </List>
);
