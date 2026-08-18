import { MobileFrame, TabBar } from '@alio/ui';

/**
 * MobileFrame is the phone-shaped viewport every screen sits in (iPhone 16,
 * 393×852). Shown here holding a stub screen so the frame reads as a frame.
 */
export const WithScreen = () => (
  <MobileFrame>
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-gray-100)' }}>
        Good morning, Ann
      </span>
      <span style={{ fontSize: 14, color: 'var(--color-gray-60)' }}>
        Sarah is with Dorothy right now.
      </span>
      <div
        style={{
          height: 120,
          borderRadius: 20,
          background: 'var(--color-gray-10)',
        }}
      />
      <div
        style={{
          height: 120,
          borderRadius: 20,
          background: 'var(--color-gray-10)',
        }}
      />
    </div>
    <TabBar className="bottom-4 left-1/2 -translate-x-1/2" variant="family" />
  </MobileFrame>
);
