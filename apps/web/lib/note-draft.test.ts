import type { Note } from '@notebook/shared';
import { describe, expect, it } from 'vitest';
import { diffDraft, draftFromNote, hasChanges, sameDraft } from './note-draft';

const note: Note = {
  id: '3f1c2a9e-8b7d-4c6e-9a5f-1e2d3c4b5a69',
  title: 'Tiêu đề',
  content: 'Nội dung',
  type: 'LEARNING',
  status: 'INBOX',
  entryDate: '2026-10-26',
  pinned: false,
  version: 3,
  createdAt: '2026-10-26T01:00:00.000Z',
  updatedAt: '2026-10-26T01:00:00.000Z',
  deletedAt: null,
  tags: [
    { id: 'a', name: 'docker' },
    { id: 'b', name: 'linux' },
  ],
};

describe('diffDraft', () => {
  it('is empty for an untouched draft', () => {
    expect(diffDraft(note, draftFromNote(note))).toEqual({});
    expect(hasChanges(note, draftFromNote(note))).toBe(false);
  });

  it('ignores differences the API normalizes away (title whitespace, NFC, tag order)', () => {
    const d = draftFromNote(note);
    expect(
      hasChanges(note, {
        ...d,
        title: `  ${note.title.normalize('NFD')} `,
        tags: ['linux', 'docker'],
      }),
    ).toBe(false);
  });

  it('returns only changed fields', () => {
    const d = { ...draftFromNote(note), content: 'Mới', pinned: true, tags: ['docker'] };
    expect(diffDraft(note, d)).toEqual({ content: 'Mới', pinned: true, tags: ['docker'] });
  });
});

describe('sameDraft', () => {
  it('compares normalized drafts', () => {
    const d = draftFromNote(note);
    expect(sameDraft(d, { ...d, title: ` ${d.title} `, tags: [...d.tags].reverse() })).toBe(true);
    expect(sameDraft(d, { ...d, content: 'khác' })).toBe(false);
    expect(sameDraft(d, { ...d, pinned: true })).toBe(false);
  });
});
