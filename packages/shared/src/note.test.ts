import { describe, expect, it } from 'vitest';
import {
  createNoteSchema,
  LIST_LIMIT_DEFAULT,
  listNotesQuerySchema,
  NOTE_TAGS_MAX,
  noteListItemSchema,
  noteSchema,
  updateNoteSchema,
} from './note';
import { versionConflictErrorSchema } from './error';

const ID = '3f1c2a9e-8b7d-4c6e-9a5f-1e2d3c4b5a69';

describe('createNoteSchema', () => {
  it('fills defaults: INBOX, LEARNING, empty title/content, not pinned, no tags', () => {
    expect(createNoteSchema.parse({ id: ID, entryDate: '2026-10-26' })).toEqual({
      id: ID,
      entryDate: '2026-10-26',
      title: '',
      content: '',
      type: 'LEARNING',
      status: 'INBOX',
      pinned: false,
      tags: [],
    });
  });

  it('normalizes tags and removes duplicates after normalization', () => {
    const out = createNoteSchema.parse({
      id: ID,
      entryDate: '2026-10-26',
      tags: ['Docker', 'docker ', '  DOCKER', 'Việt'],
    });
    expect(out.tags).toEqual(['docker', 'việt'.normalize('NFC')]);
  });

  it('trims title but keeps whitespace in content', () => {
    const out = createNoteSchema.parse({
      id: ID,
      entryDate: '2026-10-26',
      title: '  Tiêu đề  ',
      content: '    code block\n',
    });
    expect(out.title).toBe('Tiêu đề');
    expect(out.content).toBe('    code block\n');
  });

  it('rejects unknown keys (strict)', () => {
    expect(
      createNoteSchema.safeParse({ id: ID, entryDate: '2026-10-26', version: 3 }).success,
    ).toBe(false);
  });

  it('rejects invalid entryDate', () => {
    for (const entryDate of ['2026-02-30', '26-10-2026', '2026-10-26T00:00:00Z', '']) {
      expect(createNoteSchema.safeParse({ id: ID, entryDate }).success).toBe(false);
    }
  });

  it('rejects missing id / entryDate and too many tags', () => {
    expect(createNoteSchema.safeParse({ entryDate: '2026-10-26' }).success).toBe(false);
    expect(createNoteSchema.safeParse({ id: ID }).success).toBe(false);
    const tags = Array.from({ length: NOTE_TAGS_MAX + 1 }, (_, i) => `t${i}`);
    expect(createNoteSchema.safeParse({ id: ID, entryDate: '2026-10-26', tags }).success).toBe(
      false,
    );
  });
});

describe('updateNoteSchema', () => {
  it('requires at least one field besides version', () => {
    expect(updateNoteSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(updateNoteSchema.safeParse({ version: 1, pinned: true }).success).toBe(true);
    expect(updateNoteSchema.safeParse({ version: 1, tags: [] }).success).toBe(true);
  });

  it('rejects version 0, non-integer and values above int32', () => {
    expect(updateNoteSchema.safeParse({ version: 0, title: 'a' }).success).toBe(false);
    expect(updateNoteSchema.safeParse({ version: 1.5, title: 'a' }).success).toBe(false);
    expect(updateNoteSchema.safeParse({ version: 2 ** 31, title: 'a' }).success).toBe(false);
    expect(updateNoteSchema.safeParse({ version: 2 ** 31 - 1, title: 'a' }).success).toBe(true);
  });

  it('rejects unknown keys and missing version', () => {
    expect(updateNoteSchema.safeParse({ version: 1, id: ID }).success).toBe(false);
    expect(updateNoteSchema.safeParse({ title: 'a' }).success).toBe(false);
  });
});

describe('listNotesQuerySchema', () => {
  it('applies defaults', () => {
    expect(listNotesQuerySchema.parse({})).toEqual({
      trashed: false,
      page: 1,
      limit: LIST_LIMIT_DEFAULT,
    });
  });

  it('coerces page/limit from query strings', () => {
    const out = listNotesQuerySchema.parse({ page: '3', limit: '20' });
    expect(out.page).toBe(3);
    expect(out.limit).toBe(20);
    expect(listNotesQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(listNotesQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(listNotesQuerySchema.safeParse({ page: 'abc' }).success).toBe(false);
  });

  it('parses trashed as a string boolean', () => {
    expect(listNotesQuerySchema.parse({ trashed: 'false' }).trashed).toBe(false);
    expect(listNotesQuerySchema.parse({ trashed: 'true' }).trashed).toBe(true);
    expect(listNotesQuerySchema.safeParse({ trashed: 'maybe' }).success).toBe(false);
  });

  it('turns empty q into undefined', () => {
    expect(listNotesQuerySchema.parse({ q: '' }).q).toBeUndefined();
    expect(listNotesQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
    expect(listNotesQuerySchema.parse({ q: ' dock ' }).q).toBe('dock');
  });

  it('normalizes tag and ignores unknown query keys', () => {
    const out = listNotesQuerySchema.parse({ tag: ' Docker ', _: '123' });
    expect(out.tag).toBe('docker');
    expect(out).not.toHaveProperty('_');
  });
});

describe('response schemas', () => {
  const note = {
    id: ID,
    title: 't',
    content: 'c',
    type: 'LEARNING',
    status: 'INBOX',
    entryDate: '2026-10-26',
    pinned: false,
    version: 1,
    createdAt: '2026-10-26T01:02:03.000Z',
    updatedAt: '2026-10-26T01:02:03.000Z',
    deletedAt: null,
    tags: [{ id: '0b9c8d7e-6f5a-4b3c-8d2e-1f0a9b8c7d6e', name: 'docker' }],
  };

  it('parses a note and a list item', () => {
    expect(noteSchema.parse(note)).toEqual(note);
    const { content: _, ...rest } = note;
    expect(noteListItemSchema.parse({ ...rest, excerpt: 'c' }).excerpt).toBe('c');
  });

  it('parses a version conflict error with current note', () => {
    const body = {
      statusCode: 409,
      code: 'VERSION_CONFLICT',
      message: 'x',
      current: note,
    };
    expect(versionConflictErrorSchema.parse(body).current.version).toBe(1);
  });
});
