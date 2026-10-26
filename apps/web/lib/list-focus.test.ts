import { describe, expect, it } from 'vitest';
import { pickFocusAfterRemoval } from './list-focus';

describe('pickFocusAfterRemoval', () => {
  const ids = ['a', 'b', 'c'];

  it('prefers the next row', () => {
    expect(pickFocusAfterRemoval(ids, 'a')).toBe('b');
    expect(pickFocusAfterRemoval(ids, 'b')).toBe('c');
  });

  it('falls back to the previous row when removing the last one', () => {
    expect(pickFocusAfterRemoval(ids, 'c')).toBe('b');
  });

  it('returns null when the list becomes empty or the id is unknown (caller focuses h1)', () => {
    expect(pickFocusAfterRemoval(['a'], 'a')).toBeNull();
    expect(pickFocusAfterRemoval(ids, 'zzz')).toBeNull();
  });
});
