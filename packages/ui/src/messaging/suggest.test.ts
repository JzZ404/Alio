import { describe, expect, it } from 'vitest';
import { suggestsPending } from './suggest';

describe('suggestsPending', () => {
  it('flags a request aimed at the caregiver', () => {
    expect(suggestsPending('Could you pick up her prescription today?')).toBe(true);
    expect(suggestsPending('Please remind her to take the blue pill')).toBe(true);
    expect(suggestsPending('Can you take her to the appointment on Thursday')).toBe(true);
  });

  it('leaves conversation alone', () => {
    expect(suggestsPending('Thanks Sarah, that is a relief')).toBe(false);
    expect(suggestsPending('She sounded happy on the phone')).toBe(false);
    expect(suggestsPending('')).toBe(false);
  });
});
