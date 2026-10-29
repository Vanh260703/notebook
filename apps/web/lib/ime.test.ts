import { describe, expect, it } from 'vitest';
import { isImeComposing, lineBreakAction } from './ime';

describe('isImeComposing', () => {
  it('is true while composing or for keyCode 229 (Safari commit keydown)', () => {
    expect(isImeComposing({ isComposing: true, keyCode: 13 })).toBe(true);
    expect(isImeComposing({ isComposing: false, keyCode: 229 })).toBe(true);
    expect(isImeComposing({ isComposing: false, keyCode: 13 })).toBe(false);
    expect(isImeComposing({})).toBe(false);
  });
});

describe('lineBreakAction (capture box, touch screens)', () => {
  it('ignores everything that is not a line break (typing, IME text, multi-line paste)', () => {
    expect(lineBreakAction({ inputType: 'insertText' }, false)).toBe('ignore');
    expect(lineBreakAction({ inputType: 'insertCompositionText', isComposing: true }, false)).toBe(
      'ignore',
    );
    expect(lineBreakAction({ inputType: 'insertFromPaste' }, false)).toBe('ignore');
    expect(lineBreakAction({ inputType: 'deleteContentBackward' }, false)).toBe('ignore');
  });

  it('saves on a line break that slipped past keydown (Gboard Enter with keyCode 229)', () => {
    expect(lineBreakAction({ inputType: 'insertLineBreak' }, false)).toBe('save');
    expect(lineBreakAction({ inputType: 'insertParagraph', isComposing: false }, false)).toBe(
      'save',
    );
  });

  it('waits for the composition to end before saving', () => {
    expect(lineBreakAction({ inputType: 'insertLineBreak', isComposing: true }, false)).toBe(
      'save-after-composition',
    );
  });

  it('keeps Shift+Enter as a newline (hardware keyboard on a tablet)', () => {
    expect(lineBreakAction({ inputType: 'insertLineBreak' }, true)).toBe('allow');
  });
});
