import { NOTE_TAGS_MAX } from '@notebook/shared';
import { describe, expect, it } from 'vitest';
import { commitTagText, shouldCommitOnInput } from './tag-input';

describe('commitTagText', () => {
  it('splits on commas, normalizes like the API and skips duplicates/blanks', () => {
    expect(commitTagText(['docker'], ' Linux, docker ,, Ngủ ')).toEqual({
      tags: ['docker', 'linux', 'ngủ'],
      error: null,
    });
  });

  it('rejects a too-long name and keeps the current tags', () => {
    const r = commitTagText(['a'], 'x'.repeat(65));
    expect(r.tags).toEqual(['a']);
    expect(r.error).toMatch(/64/);
  });

  it(`stops at ${NOTE_TAGS_MAX} tags and reports it`, () => {
    const full = Array.from({ length: NOTE_TAGS_MAX }, (_, i) => `t${i}`);
    const r = commitTagText(full, 'extra');
    expect(r.tags).toEqual(full);
    expect(r.error).toMatch(String(NOTE_TAGS_MAX));
  });
});

describe('shouldCommitOnInput', () => {
  const suggestions = ['docker', 'linux'];

  it('commits when the value contains a comma (Gboard sends key "Unidentified")', () => {
    expect(shouldCommitOnInput('abc,', 'insertText', suggestions)).toBe(true);
    expect(shouldCommitOnInput('a,b', 'insertFromPaste', [])).toBe(true);
  });

  it('commits a picked datalist suggestion (Chrome: no inputType, Firefox/Safari: insertReplacementText)', () => {
    expect(shouldCommitOnInput('docker', undefined, suggestions)).toBe(true);
    expect(shouldCommitOnInput('Linux', 'insertReplacementText', suggestions)).toBe(true);
  });

  it('does not commit while typing, or on a replacement that is not a suggestion (autocorrect)', () => {
    expect(shouldCommitOnInput('docker', 'insertText', suggestions)).toBe(false);
    expect(shouldCommitOnInput('dock', undefined, suggestions)).toBe(false);
    expect(shouldCommitOnInput('dockers', 'insertReplacementText', suggestions)).toBe(false);
    expect(shouldCommitOnInput('', undefined, suggestions)).toBe(false);
  });
});
