import { describe, expect, it } from 'vitest';
import { formatCount, readingMinutes, slugify, wordCount } from './reading';

describe('reading time', () => {
  it('counts words of the plain text (Markdown stripped)', () => {
    expect(wordCount('# Tiêu đề\n\nHôm nay **học** `docker` [link](http://x)')).toBe(7);
    expect(wordCount('')).toBe(0);
  });

  it('at least one minute, 230 words per minute', () => {
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(100)).toBe(1);
    expect(readingMinutes(1350)).toBe(6);
    expect(readingMinutes(2300)).toBe(10);
  });

  it('formats counts with Vietnamese thousands separator', () => {
    expect(formatCount(1350)).toBe('1.350');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1234567)).toBe('1.234.567');
  });
});

describe('slugify', () => {
  it('removes Vietnamese diacritics, đ → d', () => {
    expect(slugify('Bối cảnh & Lỗi gặp')).toBe('boi-canh-loi-gap');
    expect(slugify('Đường dẫn')).toBe('duong-dan');
    expect(slugify('Tiếng Việt'.normalize('NFD'))).toBe('tieng-viet');
  });

  it('collapses punctuation, trims dashes, caps at 64 characters', () => {
    expect(slugify('  docker-compose.yml  ')).toBe('docker-compose-yml');
    expect(slugify('a'.repeat(100))).toHaveLength(64);
  });

  it('empty result becomes "muc"', () => {
    expect(slugify('🔥🚀')).toBe('muc');
    expect(slugify('!!!')).toBe('muc');
  });
});
