import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NEW_DRAFT_KEY,
  clearDraft,
  createDraftWriter,
  draftKey,
  getDraftStorage,
  isDraftEmpty,
  readDraft,
  writeDraft,
  type DraftStorage,
  type StoredDraft,
} from './local-draft';

class MemoryStorage implements DraftStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

/** Storage ném lỗi ở mọi thao tác (Safari riêng tư, storage bị chặn, hết quota). */
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

const stored: StoredDraft = {
  noteId: '3f1c2a9e-8b7d-4c6e-9a5f-1e2d3c4b5a69',
  draft: {
    title: 'Tiêu đề',
    content: 'Nội dung',
    type: 'LEARNING',
    status: 'INBOX',
    entryDate: '2026-10-26',
    pinned: false,
    tags: ['docker'],
  },
  baseVersion: 3,
  savedAt: '2026-10-26T01:00:00.000Z',
};

describe('local draft storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips a draft under nb:draft:<id>', () => {
    const s = new MemoryStorage();
    const key = draftKey(stored.noteId);
    expect(key).toBe(`nb:draft:${stored.noteId}`);
    expect(writeDraft(s, key, stored)).toBe(true);
    expect(readDraft(s, key)).toEqual(stored);
    clearDraft(s, key);
    expect(readDraft(s, key)).toBeNull();
  });

  it('keeps new-note drafts in a single slot with baseVersion null', () => {
    const s = new MemoryStorage();
    const value = { ...stored, baseVersion: null };
    writeDraft(s, NEW_DRAFT_KEY, value);
    expect(NEW_DRAFT_KEY).toBe('nb:draft:new');
    expect(readDraft(s, NEW_DRAFT_KEY)).toEqual(value);
  });

  it('treats corrupt or wrongly shaped data as no draft', () => {
    const s = new MemoryStorage();
    s.setItem('a', '{not json');
    s.setItem('b', JSON.stringify({ ...stored, draft: { ...stored.draft, type: 'WHATEVER' } }));
    s.setItem('c', JSON.stringify({ ...stored, draft: { ...stored.draft, tags: [1] } }));
    s.setItem('d', JSON.stringify({ ...stored, baseVersion: '3' }));
    s.setItem('e', 'null');
    for (const k of ['a', 'b', 'c', 'd', 'e', 'missing']) expect(readDraft(s, k)).toBeNull();
  });

  it('never throws when storage is unavailable or throws', () => {
    expect(readDraft(throwing, 'k')).toBeNull();
    expect(writeDraft(throwing, 'k', stored)).toBe(false);
    expect(() => clearDraft(throwing, 'k')).not.toThrow();
    expect(readDraft(null, 'k')).toBeNull();
    expect(writeDraft(null, 'k', stored)).toBe(false);
    expect(() => clearDraft(null, 'k')).not.toThrow();
  });

  it('getDraftStorage returns null when touching localStorage throws', () => {
    expect(getDraftStorage()).toBeNull(); // node: không có window
    vi.stubGlobal('window', {
      get localStorage() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    expect(getDraftStorage()).toBeNull();
  });

  it('isDraftEmpty ignores whitespace', () => {
    expect(isDraftEmpty({ ...stored.draft, title: '  ', content: '\n', tags: [] })).toBe(true);
    expect(isDraftEmpty({ ...stored.draft, title: '', content: '', tags: ['x'] })).toBe(false);
  });
});

describe('createDraftWriter', () => {
  afterEach(() => vi.useRealTimers());

  it('debounces and only runs the latest scheduled write', () => {
    vi.useFakeTimers();
    const w = createDraftWriter(500);
    const calls: number[] = [];
    w.schedule(() => calls.push(1));
    vi.advanceTimersByTime(300);
    w.schedule(() => calls.push(2));
    vi.advanceTimersByTime(499);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual([2]);
  });

  it('flush writes immediately (tab hidden / pagehide), cancel drops the pending write', () => {
    vi.useFakeTimers();
    const w = createDraftWriter(500);
    const calls: string[] = [];
    w.schedule(() => calls.push('a'));
    expect(w.hasPending).toBe(true);
    w.flush();
    expect(calls).toEqual(['a']);
    expect(w.hasPending).toBe(false);
    w.schedule(() => calls.push('b'));
    w.cancel();
    vi.advanceTimersByTime(1000);
    w.flush();
    expect(calls).toEqual(['a']);
  });
});
