import { IconBloodPressure } from '@alio/ui';

/**
 * IconBloodPressure — one of the icons the Alio screens use. Icons are plain SVG
 * components: they default to 24x24 and paint with `currentColor`, so size
 * comes from width/height (or a size-* class) and color from the parent.
 */
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 20 }}>{children}</div>
);

export const Sizes = () => (
  <Row>
    <IconBloodPressure width={16} height={16} />
    <IconBloodPressure width={24} height={24} />
    <IconBloodPressure width={32} height={32} />
  </Row>
);

export const Colors = () => (
  <Row>
    <span style={{ color: 'var(--color-gray-100)', display: 'inline-flex' }}>
      <IconBloodPressure width={28} height={28} />
    </span>
    <span style={{ color: 'var(--color-brand-primary)', display: 'inline-flex' }}>
      <IconBloodPressure width={28} height={28} />
    </span>
    <span style={{ color: 'var(--color-gray-60)', display: 'inline-flex' }}>
      <IconBloodPressure width={28} height={28} />
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
      <IconBloodPressure width={24} height={24} />
    </span>
  </Row>
);
