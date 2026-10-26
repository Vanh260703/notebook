import { describe, expect, it } from 'vitest';
import { pageCount, pageParam, parsePage } from './list-params';

describe('parsePage', () => {
  it('reads a positive integer', () => {
    expect(parsePage('3')).toBe(3);
  });

  it('falls back to page 1 for missing, invalid, zero or negative values', () => {
    for (const raw of [null, '', 'abc', '0', '-2']) expect(parsePage(raw)).toBe(1);
  });
});

describe('pageCount', () => {
  it('rounds up and is at least 1', () => {
    expect(pageCount(0, 50)).toBe(1);
    expect(pageCount(50, 50)).toBe(1);
    expect(pageCount(51, 50)).toBe(2);
  });
});

describe('pageParam', () => {
  it('drops the parameter for page 1', () => {
    expect(pageParam(1)).toBeUndefined();
    expect(pageParam(2)).toBe('2');
  });
});
