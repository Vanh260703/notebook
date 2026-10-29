import type { TagWithCount } from '@notebook/shared';
import { describe, expect, it } from 'vitest';
import { qk } from '../../lib/query-keys';
import {
  NAV,
  NAV_COUNT_QUERIES,
  formatBadgeCount,
  isFocusRoute,
  isNavActive,
  isTagActive,
  pickSidebarTags,
} from './nav';

describe('NAV', () => {
  it('lists Hôm nay, Inbox, Ghi chú, Tag, Thùng rác in that order', () => {
    expect(NAV.map((i) => i.href)).toEqual(['/today', '/inbox', '/notes', '/tags', '/trash']);
  });
});

describe('isNavActive', () => {
  it('Hôm nay: /today (with or without ?date)', () => {
    expect(isNavActive('today', '/today')).toBe(true);
    expect(isNavActive('today', '/todays')).toBe(false);
    expect(isNavActive('today', '/notes')).toBe(false);
  });

  it('Inbox: /inbox and below', () => {
    expect(isNavActive('inbox', '/inbox')).toBe(true);
    expect(isNavActive('inbox', '/inbox/x')).toBe(true);
    expect(isNavActive('inbox', '/notes')).toBe(false);
    expect(isNavActive('inbox', '/inboxes')).toBe(false);
  });

  it('Ghi chú: the list without a tag filter, and a note page, but not /notes/new', () => {
    expect(isNavActive('notes', '/notes')).toBe(true);
    expect(isNavActive('notes', '/notes', 'docker')).toBe(false);
    expect(isNavActive('notes', '/notes/0b7c1e9e-1111-4c3e-9d0e-2f4b5a6c7d8e')).toBe(true);
    expect(isNavActive('notes', '/notes/new')).toBe(false);
    expect(isNavActive('notes', '/inbox')).toBe(false);
    expect(isNavActive('notes', '/tags')).toBe(false);
  });

  it('Tag and Thùng rác match their own routes only', () => {
    expect(isNavActive('tags', '/tags')).toBe(true);
    expect(isNavActive('tags', '/notes', 'docker')).toBe(false);
    expect(isNavActive('trash', '/trash')).toBe(true);
    expect(isNavActive('trash', '/notes')).toBe(false);
  });

  it('exactly one main item is active on each list page', () => {
    for (const path of ['/today', '/inbox', '/notes', '/tags', '/trash']) {
      expect(NAV.filter((i) => isNavActive(i.key, path)).map((i) => i.href)).toEqual([path]);
    }
  });
});

describe('isTagActive', () => {
  it('is only active on the notes list filtered by that tag', () => {
    expect(isTagActive('docker', '/notes', 'docker')).toBe(true);
    expect(isTagActive('docker', '/notes', 'nestjs')).toBe(false);
    expect(isTagActive('docker', '/notes', null)).toBe(false);
    expect(isTagActive('docker', '/tags', 'docker')).toBe(false);
  });
});

describe('isFocusRoute', () => {
  it('matches the editor (/notes/new, /notes/<id>) and reading mode (/notes/<id>/read)', () => {
    expect(isFocusRoute('/notes/new')).toBe(true);
    expect(isFocusRoute('/notes/abc')).toBe(true);
    expect(isFocusRoute('/notes/abc/read')).toBe(true);
    expect(isFocusRoute('/notes/new/read')).toBe(false);
    expect(isFocusRoute('/notes')).toBe(false);
    expect(isFocusRoute('/notes/abc/edit')).toBe(false);
    expect(isFocusRoute('/tags')).toBe(false);
    expect(isFocusRoute('/today')).toBe(false);
  });

  it('reading mode keeps "Ghi chú" highlighted', () => {
    expect(isNavActive('notes', '/notes/abc/read')).toBe(true);
    expect(isNavActive('today', '/notes/abc/read')).toBe(false);
  });
});

describe('formatBadgeCount', () => {
  it('caps at 99+', () => {
    expect(formatBadgeCount(3)).toBe('3');
    expect(formatBadgeCount(99)).toBe('99');
    expect(formatBadgeCount(100)).toBe('99+');
  });
});

describe('pickSidebarTags', () => {
  const tag = (name: string, noteCount: number): TagWithCount => ({
    id: `00000000-0000-4000-8000-${name.padStart(12, '0').slice(-12)}`,
    name,
    noteCount,
  });

  it('drops empty tags and sorts by note count, then by name', () => {
    const r = pickSidebarTags([tag('b', 2), tag('empty', 0), tag('a', 2), tag('c', 9)]);
    expect(r.items.map((t) => t.name)).toEqual(['c', 'a', 'b']);
    expect(r.hasMore).toBe(true); // "empty" chỉ thấy ở trang Tag
  });

  it('keeps at most `limit` tags and reports whether there are more', () => {
    const many = Array.from({ length: 10 }, (_, i) => tag(`t${i}`, i + 1));
    const r = pickSidebarTags(many);
    expect(r.items).toHaveLength(8);
    expect(r.items[0]?.name).toBe('t9');
    expect(r.hasMore).toBe(true);
    expect(pickSidebarTags(many.slice(0, 3)).hasMore).toBe(false);
  });

  it('does not mutate the input', () => {
    const input = [tag('a', 1), tag('b', 5)];
    pickSidebarTags(input);
    expect(input.map((t) => t.name)).toEqual(['a', 'b']);
  });
});

describe('NAV_COUNT_QUERIES', () => {
  it('fetch a single row and live under the note-list key (refreshed by afterNoteSaved)', () => {
    for (const q of Object.values(NAV_COUNT_QUERIES)) {
      expect(q.limit).toBe(1);
      expect(qk.noteList(q).slice(0, qk.noteLists.length)).toEqual([...qk.noteLists]);
    }
  });

  it('the notes count excludes ARCHIVED, like the default notes list', () => {
    expect(NAV_COUNT_QUERIES.notes.excludeArchived).toBe(true);
  });
});
