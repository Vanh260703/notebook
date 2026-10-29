import { describe, expect, it } from 'vitest';
import { isImeComposing } from './ime';

describe('isImeComposing', () => {
  it('is true while composing or for keyCode 229 (Safari commit keydown)', () => {
    expect(isImeComposing({ isComposing: true, keyCode: 13 })).toBe(true);
    expect(isImeComposing({ isComposing: false, keyCode: 229 })).toBe(true);
    expect(isImeComposing({ isComposing: false, keyCode: 13 })).toBe(false);
    expect(isImeComposing({})).toBe(false);
  });
});
