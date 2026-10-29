import { TRASH_RETENTION_DAYS, noteSchema, type Note } from '@notebook/shared';
import { DataSource } from 'typeorm';
import { TrashPurgeService } from '../../src/modules/notes/trash-purge.service';
import { createTestApp, newNote, type TestContext } from './helpers';

const DAY = 86_400_000;

describe('Trash purge (e2e)', () => {
  let t: TestContext;
  let ds: DataSource;
  let purge: TrashPurgeService;

  beforeAll(async () => {
    t = await createTestApp();
    ds = t.app.get(DataSource);
    purge = t.app.get(TrashPurgeService);
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  const create = async (tags: string[] = []): Promise<Note> =>
    noteSchema.parse((await t.agent.post('/notes').send(newNote({ tags })).expect(201)).body);

  const setDeletedAt = (id: string, at: Date | null) =>
    ds.query(`UPDATE "Note" SET "deletedAt" = $2 WHERE "id" = $1`, [id, at]);

  it('deletes only notes trashed more than the retention period ago; idempotent; tags stay', async () => {
    const now = new Date();
    const old = await create(['docker', 'linux']);
    const recent = await create(['docker']);
    const live = await create(['docker']);
    await setDeletedAt(old.id, new Date(now.getTime() - (TRASH_RETENTION_DAYS + 1) * DAY));
    await setDeletedAt(recent.id, new Date(now.getTime() - (TRASH_RETENTION_DAYS - 1) * DAY));

    expect(await purge.purgeExpired(now)).toBe(1);
    expect(await purge.purgeExpired(now)).toBe(0);

    await t.agent.get(`/notes/${old.id}`).expect(404);
    await t.agent.get(`/notes/${recent.id}`).expect(200);
    await t.agent.get(`/notes/${live.id}`).expect(200);

    const noteTags = await ds.query<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM "NoteTag" WHERE "noteId" = $1`,
      [old.id],
    );
    expect(noteTags[0]?.count).toBe(0);
    // Tag mồ côi ("linux") không tự xóa.
    const tags = await ds.query<{ name: string }[]>(`SELECT "name" FROM "Tag" ORDER BY "name"`);
    expect(tags.map((x) => x.name)).toEqual(['docker', 'linux']);
  });

  it('runOnce never throws and the boundary is strict (exactly 30 days is kept)', async () => {
    const now = new Date();
    const edge = await create();
    await setDeletedAt(edge.id, new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY));
    expect(await purge.purgeExpired(now)).toBe(0);
    await expect(purge.runOnce()).resolves.toBeUndefined();
  });
});
