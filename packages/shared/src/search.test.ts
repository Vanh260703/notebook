import { describe, expect, it } from 'vitest';
import {
  HIGHLIGHT_END as E,
  HIGHLIGHT_START as S,
  SEARCH_TERM_MAX_LENGTH,
  SEARCH_TERMS_MAX,
  hasHighlight,
  prefixTsquery,
  searchTerms,
  splitHighlight,
  stripHighlight,
} from './search';

describe('searchTerms', () => {
  it('keeps Vietnamese diacritics and lowercases', () => {
    expect(searchTerms('Đường Dẫn')).toEqual(['đường', 'dẫn']);
  });

  it('splits code tokens on punctuation', () => {
    expect(searchTerms('docker-compose.yml')).toEqual(['docker', 'compose', 'yml']);
    expect(searchTerms('@nestjs/typeorm')).toEqual(['nestjs', 'typeorm']);
    expect(searchTerms('  dock   vol  ')).toEqual(['dock', 'vol']);
  });

  it('removes duplicates, caps the number and length of terms', () => {
    expect(searchTerms('a A a b')).toEqual(['a', 'b']);
    const many = Array.from({ length: 12 }, (_, i) => `t${i}`).join(' ');
    expect(searchTerms(many)).toHaveLength(SEARCH_TERMS_MAX);
    const long = 'ệ'.repeat(100);
    expect(Array.from(searchTerms(long)[0] ?? '')).toHaveLength(SEARCH_TERM_MAX_LENGTH);
  });

  it('returns [] when there is no letter or digit', () => {
    expect(searchTerms('!!!')).toEqual([]);
    expect(searchTerms('🔥🚀')).toEqual([]);
    expect(searchTerms('')).toEqual([]);
  });

  it('NFD input gives the same result as NFC', () => {
    const nfc = 'Tiếng Việt đường';
    expect(searchTerms(nfc.normalize('NFD'))).toEqual(searchTerms(nfc));
  });
});

describe('prefixTsquery', () => {
  it('joins prefix terms with &, optionally restricted to a weight', () => {
    expect(prefixTsquery(['dock', 'vol'])).toBe("'dock':* & 'vol':*");
    expect(prefixTsquery(['dock', 'vol'], 'A')).toBe("'dock':*A & 'vol':*A");
  });

  it("never contains ' or \\ inside a term, whatever the user typed", () => {
    const q = prefixTsquery(searchTerms("a' | b:*\\( c&!d <-> 'x'"));
    expect(q).toBe("'a':* & 'b':* & 'c':* & 'd':* & 'x':*");
    for (const part of q.split(' & ')) expect(part.slice(1, -3)).not.toMatch(/['\\]/);
  });
});

describe('splitHighlight', () => {
  it('splits paired markers', () => {
    expect(splitHighlight(`Lỗi ${S}Docker${E} ${S}volume${E}`)).toEqual([
      { text: 'Lỗi ', hit: false },
      { text: 'Docker', hit: true },
      { text: ' ', hit: false },
      { text: 'volume', hit: true },
    ]);
  });

  it('a start marker without end highlights to the end; a lone end marker is ignored', () => {
    expect(splitHighlight(`ab ${S}cd`)).toEqual([
      { text: 'ab ', hit: false },
      { text: 'cd', hit: true },
    ]);
    expect(splitHighlight(`ab${E} cd`)).toEqual([{ text: 'ab cd', hit: false }]);
  });

  it('no markers: one plain part; empty string: no parts', () => {
    expect(splitHighlight('chữ thường')).toEqual([{ text: 'chữ thường', hit: false }]);
    expect(splitHighlight('')).toEqual([]);
  });

  it('hasHighlight / stripHighlight', () => {
    expect(hasHighlight(`a ${S}b${E}`)).toBe(true);
    expect(hasHighlight('a b')).toBe(false);
    expect(stripHighlight(`a ${S}b${E}`)).toBe('a b');
  });
});
