import { describe, expect, it } from 'vitest';
import {
  INLINE_DRAFT_KEY,
  SHEET_DRAFT_KEY,
  clearCaptureDrafts,
  readCaptureDraft,
  writeCaptureDraft,
} from './capture-draft';
import type { DraftStorage } from './local-draft';

function memory() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
  };
  return { map, storage };
}

const throwing: DraftStorage = {
  getItem: () => {
    throw new DOMException('denied', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('full', 'QuotaExceededError');
  },
  removeItem: () => {
    throw new DOMException('denied', 'SecurityError');
  },
};

describe('capture draft', () => {
  it('saves and restores the text exactly (newlines, Vietnamese, #tags)', () => {
    const { storage } = memory();
    const text = 'Ý tưởng mới #ideas\n  dòng hai ';
    expect(writeCaptureDraft(storage, SHEET_DRAFT_KEY, text)).toBe(true);
    expect(readCaptureDraft(storage, SHEET_DRAFT_KEY)).toBe(text);
    // Sheet và ô trong trang Hôm nay giữ nháp riêng.
    expect(readCaptureDraft(storage, INLINE_DRAFT_KEY)).toBe('');
  });

  it('blank text removes the draft', () => {
    const { storage, map } = memory();
    writeCaptureDraft(storage, SHEET_DRAFT_KEY, 'abc');
    writeCaptureDraft(storage, SHEET_DRAFT_KEY, '  \n ');
    expect(map.has(SHEET_DRAFT_KEY)).toBe(false);
    expect(readCaptureDraft(storage, SHEET_DRAFT_KEY)).toBe('');
  });

  it('missing or blocked storage never throws', () => {
    expect(readCaptureDraft(null, SHEET_DRAFT_KEY)).toBe('');
    expect(writeCaptureDraft(null, SHEET_DRAFT_KEY, 'x')).toBe(false);
    expect(readCaptureDraft(throwing, SHEET_DRAFT_KEY)).toBe('');
    expect(writeCaptureDraft(throwing, SHEET_DRAFT_KEY, 'x')).toBe(false);
    expect(writeCaptureDraft(throwing, SHEET_DRAFT_KEY, '')).toBe(false);
  });

  it('clearCaptureDrafts (logout) removes every capture draft and nothing else', () => {
    const { storage, map } = memory();
    map.set(SHEET_DRAFT_KEY, 'a');
    map.set(INLINE_DRAFT_KEY, 'b');
    map.set('nb:capture-type', 'PERSONAL');
    map.set('nb:capture-handoff', '{}');
    map.set('nb:draft:new', '{}');
    clearCaptureDrafts(storage);
    expect([...map.keys()]).toEqual(['nb:capture-type', 'nb:capture-handoff', 'nb:draft:new']);
    expect(() => clearCaptureDrafts(null)).not.toThrow();
  });
});
