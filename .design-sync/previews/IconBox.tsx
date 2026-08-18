import { IconBox, IconSearch, IconPlus, IconKeyboard, IconMicrophone } from '@alio/ui';

/** IconBox is the tinted icon button used across the Logs, AI and Chat screens. */
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>{children}</div>
);

export const Shapes = () => (
  <Row>
    <IconBox aria-label="Search">
      <IconSearch className="size-6 text-gray-100" />
    </IconBox>
    <IconBox shape="pill" aria-label="Add">
      <IconPlus className="size-6 text-gray-100" />
    </IconBox>
  </Row>
);

export const Sizes = () => (
  <Row>
    <IconBox size={48} aria-label="Keyboard">
      <IconKeyboard className="size-6 text-gray-100" />
    </IconBox>
    <IconBox size={42} aria-label="Keyboard">
      <IconKeyboard className="size-5 text-gray-100" />
    </IconBox>
  </Row>
);

export const InToolbar = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: 300,
      padding: 12,
      borderRadius: 20,
      background: 'var(--color-brand-tint-2)',
    }}
  >
    <IconBox shape="pill" aria-label="Keyboard">
      <IconKeyboard className="size-6 text-gray-100" />
    </IconBox>
    <IconBox shape="pill" aria-label="Record">
      <IconMicrophone className="size-6 text-brand-active" />
    </IconBox>
    <IconBox shape="pill" aria-label="Search">
      <IconSearch className="size-6 text-gray-100" />
    </IconBox>
  </div>
);
