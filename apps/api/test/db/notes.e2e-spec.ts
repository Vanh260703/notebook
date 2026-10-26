import { randomUUID } from 'node:crypto';
import {
  apiErrorSchema,
  noteListResponseSchema,
  noteSchema,
  versionConflictErrorSchema,
  type Note,
} from '@notebook/shared';
import { createTestApp, newNote, type TestContext } from './helpers';

describe('Notes (e2e)', () => {
  let t: TestContext;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  const create = async (over: Parameters<typeof newNote>[0] = {}): Promise<Note> =>
    noteSchema.parse((await t.agent.post('/notes').send(newNote(over)).expect(201)).body);

  const list = async (query = '') =>
    noteListResponseSchema.parse((await t.agent.get(`/notes${query}`).expect(200)).body);

  describe('POST /notes', () => {
    it('201 on first create with INBOX/LEARNING defaults and version 1', async () => {
      const input = newNote({ tags: ['Docker', 'docker ', 'Linux'] });
      const res = await t.agent.post('/notes').send(input).expect(201);
      const note = noteSchema.parse(res.body);
      expect(note).toMatchObject({
        id: input.id,
        title: input.title,
        content: input.content,
        status: 'INBOX',
        type: 'LEARNING',
        pinned: false,
        version: 1,
        entryDate: '2026-10-26',
        deletedAt: null,
      });
      // "Docker" và "docker " là một tag; tag sắp theo tên.
      expect(note.tags.map((x) => x.name)).toEqual(['docker', 'linux']);
    });

    it('is idempotent by id: 200 with the stored note, never overwrites', async () => {
      const input = newNote({ title: 'Bản gốc' });
      await t.agent.post('/notes').send(input).expect(201);
      const again = await t.agent
        .post('/notes')
        .send({ ...input, title: 'Bản khác', tags: ['x'] })
        .expect(200);
      expect(noteSchema.parse(again.body)).toMatchObject({ title: 'Bản gốc', tags: [] });
      expect((await list()).total).toBe(1);
    });

    it('re-sending the id of a soft-deleted note returns it without restoring', async () => {
      const note = await create();
      await t.agent.delete(`/notes/${note.id}`).expect(204);
      const res = await t.agent
        .post('/notes')
        .send(newNote({ id: note.id }))
        .expect(200);
      expect(noteSchema.parse(res.body).deletedAt).not.toBeNull();
    });

    it('400 VALIDATION_FAILED with issue paths', async () => {
      const res = await t.agent
        .post('/notes')
        .send({ ...newNote(), entryDate: '2026-02-30', tags: [''] })
        .expect(400);
      const body = apiErrorSchema.parse(res.body);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.issues?.map((i) => i.path)).toEqual(
        expect.arrayContaining(['entryDate', 'tags.0']),
      );
    });

    it('accepts large notes (~450 kB) but rejects bodies over 1 MB with 413', async () => {
      await t.agent
        .post('/notes')
        .send(newNote({ content: 'ệ'.repeat(150_000) }))
        .expect(201);
      const res = await t.agent
        .post('/notes')
        .send(newNote({ content: 'x'.repeat(1_100_000) }))
        .expect(413);
      expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('400 for malformed JSON', async () => {
      const res = await t.agent
        .post('/notes')
        .set('Content-Type', 'application/json')
        .send('{"id": ')
        .expect(400);
      expect(apiErrorSchema.parse(res.body).code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /notes/:id', () => {
    it('returns the note, 404 NOTE_NOT_FOUND, 400 for a non-uuid id', async () => {
      const note = await create();
      expect(noteSchema.parse((await t.agent.get(`/notes/${note.id}`).expect(200)).body)).toEqual(
        note,
      );
      const nf = await t.agent.get(`/notes/${randomUUID()}`).expect(404);
      expect(nf.body.code).toBe('NOTE_NOT_FOUND');
      const bad = await t.agent.get('/notes/not-a-uuid').expect(400);
      expect(apiErrorSchema.parse(bad.body).code).toBe('BAD_REQUEST');
    });

    it('returns trashed notes with deletedAt set', async () => {
      const note = await create();
      await t.agent.delete(`/notes/${note.id}`).expect(204);
      const res = await t.agent.get(`/notes/${note.id}`).expect(200);
      expect(noteSchema.parse(res.body).deletedAt).not.toBeNull();
    });
  });

  describe('PATCH /notes/:id', () => {
    it('updates only sent fields and bumps version by 1 (also for tag/pin-only changes)', async () => {
      const note = await create({ tags: ['a'] });
      const r1 = noteSchema.parse(
        (await t.agent.patch(`/notes/${note.id}`).send({ version: 1, title: 'Mới' }).expect(200))
          .body,
      );
      expect(r1).toMatchObject({ title: 'Mới', content: note.content, version: 2 });
      expect(r1.tags.map((x) => x.name)).toEqual(['a']);
      expect(Date.parse(r1.updatedAt)).toBeGreaterThanOrEqual(Date.parse(note.updatedAt));

      const r2 = noteSchema.parse(
        (
          await t.agent
            .patch(`/notes/${note.id}`)
            .send({ version: 2, tags: ['B', 'c'] })
            .expect(200)
        ).body,
      );
      expect(r2.version).toBe(3);
      expect(r2.tags.map((x) => x.name)).toEqual(['b', 'c']);

      const r3 = noteSchema.parse(
        (await t.agent.patch(`/notes/${note.id}`).send({ version: 3, pinned: true }).expect(200))
          .body,
      );
      expect(r3).toMatchObject({ pinned: true, version: 4 });

      const r4 = noteSchema.parse(
        (await t.agent.patch(`/notes/${note.id}`).send({ version: 4, tags: [] }).expect(200)).body,
      );
      expect(r4.tags).toEqual([]);
    });

    it('409 VERSION_CONFLICT with current note (including tags) on stale version', async () => {
      const note = await create({ tags: ['docker'] });
      await t.agent.patch(`/notes/${note.id}`).send({ version: 1, title: 'A' }).expect(200);
      const res = await t.agent
        .patch(`/notes/${note.id}`)
        .send({ version: 1, title: 'B' })
        .expect(409);
      const body = versionConflictErrorSchema.parse(res.body);
      expect(body.current).toMatchObject({ title: 'A', version: 2 });
      expect(body.current.tags.map((x) => x.name)).toEqual(['docker']);
    });

    it('two concurrent PATCHes with the same version: exactly one 200 and one 409', async () => {
      const note = await create();
      const [a, b] = await Promise.all([
        t.agent.patch(`/notes/${note.id}`).send({ version: 1, title: 'A', tags: ['x'] }),
        t.agent.patch(`/notes/${note.id}`).send({ version: 1, title: 'B', tags: ['y'] }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const final = noteSchema.parse((await t.agent.get(`/notes/${note.id}`).expect(200)).body);
      expect(final.version).toBe(2);
      const winner = a.status === 200 ? 'A' : 'B';
      expect(final.title).toBe(winner);
      expect(final.tags.map((x) => x.name)).toEqual([winner === 'A' ? 'x' : 'y']);
    });

    it('404 NOTE_IN_TRASH for soft-deleted notes, 404 NOTE_NOT_FOUND for unknown ids', async () => {
      const note = await create();
      await t.agent.delete(`/notes/${note.id}`).expect(204);
      const res = await t.agent
        .patch(`/notes/${note.id}`)
        .send({ version: 1, title: 'x' })
        .expect(404);
      expect(res.body.code).toBe('NOTE_IN_TRASH');
      const nf = await t.agent
        .patch(`/notes/${randomUUID()}`)
        .send({ version: 1, title: 'x' })
        .expect(404);
      expect(nf.body.code).toBe('NOTE_NOT_FOUND');
    });

    it('400 when only version is sent', async () => {
      const note = await create();
      const res = await t.agent.patch(`/notes/${note.id}`).send({ version: 1 }).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('DELETE, restore, permanent', () => {
    it('soft delete hides from the default list, shows with trashed=true, restore brings it back', async () => {
      const note = await create();
      await t.agent.delete(`/notes/${note.id}`).expect(204);
      await t.agent.delete(`/notes/${note.id}`).expect(204); // idempotent

      expect((await list()).items).toHaveLength(0);
      const trash = await list('?trashed=true');
      expect(trash.items.map((x) => x.id)).toEqual([note.id]);
      expect(trash.items[0].deletedAt).not.toBeNull();

      const restored = noteSchema.parse(
        (await t.agent.post(`/notes/${note.id}/restore`).expect(200)).body,
      );
      expect(restored).toMatchObject({ deletedAt: null, version: 1 });
      await t.agent.post(`/notes/${note.id}/restore`).expect(200); // idempotent
      expect((await list()).items).toHaveLength(1);
    });

    it('permanent delete: 409 NOTE_NOT_IN_TRASH for live notes, 204 for trashed ones', async () => {
      const note = await create({ tags: ['t'] });
      const res = await t.agent.delete(`/notes/${note.id}/permanent`).expect(409);
      expect(res.body.code).toBe('NOTE_NOT_IN_TRASH');
      await t.agent.delete(`/notes/${note.id}`).expect(204);
      await t.agent.delete(`/notes/${note.id}/permanent`).expect(204);
      await t.agent.get(`/notes/${note.id}`).expect(404);
      await t.agent.delete(`/notes/${note.id}/permanent`).expect(404);
    });

    it('404 for unknown ids', async () => {
      await t.agent.delete(`/notes/${randomUUID()}`).expect(404);
      await t.agent.post(`/notes/${randomUUID()}/restore`).expect(404);
    });
  });

  describe('GET /notes', () => {
    it('orders by pinned, then updatedAt desc; items have excerpt instead of content', async () => {
      const a = await create({ title: 'A', content: 'x'.repeat(500) });
      const b = await create({ title: 'B' });
      const c = await create({ title: 'C', pinned: true });
      await t.agent.patch(`/notes/${a.id}`).send({ version: 1, title: 'A2' }).expect(200);

      const res = await list();
      expect(res.items.map((x) => x.id)).toEqual([c.id, a.id, b.id]);
      expect(res.items[1].excerpt).toHaveLength(300);
      expect(res.items[1]).not.toHaveProperty('content');
      expect(res).toMatchObject({ page: 1, limit: 50, total: 3, hasMore: false });
    });

    it('filters by type, status, tag and date; paginates', async () => {
      await create({ type: 'PERSONAL', tags: ['nhật ký'], entryDate: '2026-10-25' });
      await create({ status: 'ACTIVE', tags: ['docker'] });
      await create({ tags: ['Docker', 'linux'] });

      expect((await list('?type=PERSONAL')).total).toBe(1);
      expect((await list('?status=ACTIVE')).total).toBe(1);
      expect((await list('?status=INBOX')).total).toBe(2);
      expect((await list('?tag=DOCKER')).total).toBe(2);
      expect((await list(`?tag=${encodeURIComponent('Nhật ký')}`)).total).toBe(1);
      expect((await list('?date=2026-10-25')).total).toBe(1);

      const p1 = await list('?limit=2&page=1');
      const p2 = await list('?limit=2&page=2');
      expect(p1).toMatchObject({ total: 3, hasMore: true });
      expect(p2).toMatchObject({ total: 3, hasMore: false });
      expect(p2.items).toHaveLength(1);
      expect(new Set([...p1.items, ...p2.items].map((x) => x.id)).size).toBe(3);
      // Tag của từng item có mặt trong danh sách.
      expect(p1.items.every((x) => x.tags.length > 0)).toBe(true);
    });

    it('501 NOT_IMPLEMENTED for q, 400 for invalid filters', async () => {
      const res = await t.agent.get('/notes?q=x').expect(501);
      expect(apiErrorSchema.parse(res.body).code).toBe('NOT_IMPLEMENTED');
      await t.agent.get('/notes?q=').expect(200);
      await t.agent.get('/notes?status=DONE').expect(400);
      await t.agent.get('/notes?limit=1000').expect(400);
      await t.agent.get('/notes?date=2026-13-01').expect(400);
    });
  });
});
