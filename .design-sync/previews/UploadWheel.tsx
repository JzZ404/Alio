import { UploadWheel } from '@alio/ui';

/**
 * UploadWheel fans out above the "+" button on Family AI Check. It is absolutely
 * positioned, so it needs a positioned parent — here a stub composer area. The
 * closed state renders nothing, so only the open state is shown.
 */
export const Open = () => (
  <div
    style={{
      position: 'relative',
      width: 300,
      height: 300,
      borderRadius: 20,
      background: 'var(--color-brand-tint-2)',
    }}
  >
    <div
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 16,
        height: 44,
        borderRadius: 22,
        background: 'var(--color-gray-10)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 16,
        fontSize: 14,
        color: 'var(--color-gray-60)',
      }}
    >
      Ask Alio about Dorothy
    </div>
    <UploadWheel open onClose={() => {}} onPick={() => {}} className="bottom-[76px] right-[16px]" />
  </div>
);
