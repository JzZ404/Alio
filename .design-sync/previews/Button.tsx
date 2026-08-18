import { Button, IconRiVoiceAiFill } from '@alio/ui';

/**
 * Button is the labeled action button. Four variants at two heights — icon-only
 * buttons are IconBox or FloatingAddButton instead.
 */
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, flexWrap: 'wrap' }}>
    {children}
  </div>
);

export const Variants = () => (
  <Row>
    <Button variant="primary">Save</Button>
    <Button variant="secondary">Cancel</Button>
  </Row>
);

export const AccentAndDanger = () => (
  <Row>
    <Button variant="accent">
      <IconRiVoiceAiFill className="size-6 text-brand-active" />
      Press to Speak
    </Button>
    <Button variant="danger">Done</Button>
  </Row>
);

export const Sizes = () => (
  <Row>
    <Button size="md">Medium</Button>
    <Button size="sm">Small</Button>
  </Row>
);

export const Disabled = () => (
  <Row>
    <Button disabled>Save</Button>
    <Button variant="secondary" disabled>
      Cancel
    </Button>
  </Row>
);

export const ModalFooter = () => (
  <div
    style={{
      display: 'flex',
      gap: 10,
      width: 320,
      padding: 16,
      borderRadius: 20,
      background: 'var(--color-gray-10)',
    }}
  >
    <Button variant="secondary" className="flex-1">
      Cancel
    </Button>
    <Button className="flex-1">Save</Button>
  </div>
);
