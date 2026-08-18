import { AddRecordModal } from '@alio/ui';

/**
 * AddRecordModal is the sheet raised from the Records "+" button. It fills its
 * positioned parent and dims what is behind it, so the card frames a stub
 * Records page underneath.
 */
export const Open = () => (
  <div
    style={{
      position: 'relative',
      width: 393,
      height: 560,
      overflow: 'hidden',
      borderRadius: 24,
      background: 'var(--color-brand-tint-2)',
    }}
  >
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-gray-100)' }}>Records</span>
      <div style={{ height: 70, borderRadius: 12, background: 'var(--color-brand-tint-1)' }} />
      <div style={{ height: 70, borderRadius: 12, background: 'var(--color-brand-tint-1)' }} />
    </div>
    <AddRecordModal open onClose={() => {}} onSave={() => {}} />
  </div>
);
