import { IconImage } from '@alio/ui';

/**
 * IconImage — one of the icons the Alio screens use. Icons are plain SVG
 * components: they default to 24x24 and paint with `currentColor`, so size
 * comes from width/height (or a size-* class) and color from the parent.
 */
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 20 }}>{children}</div>
);

export const Sizes = () => (
  <Row>
    <IconImage width={16} height={16} />
    <IconImage width={24} height={24} />
    <IconImage width={32} height={32} />
  </Row>
);

export const Colors = () => (
  <Row>
    <span style={{ color: 'var(--color-gray-100)', display: 'inline-flex' }}>
      <IconImage width={28} height={28} />
    </span>
    <span style={{ color: 'var(--color-brand-primary)', display: 'inline-flex' }}>
      <IconImage width={28} height={28} />
    </span>
    <span style={{ color: 'var(--color-gray-60)', display: 'inline-flex' }}>
      <IconImage width={28} height={28} />
    </span>
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 12,
        background: 'var(--color-brand-tint-1)',
        color: 'var(--color-brand-primary)',
      }}
    >
      <IconImage width={24} height={24} />
    </span>
  </Row>
);
