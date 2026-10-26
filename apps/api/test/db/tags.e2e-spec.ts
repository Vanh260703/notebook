import { randomUUID } from 'node:crypto';
import {
  noteSchema,
  tagListResponseSchema,
  tagNameTakenErrorSchema,
  tagWithCountSchema,
} from '@notebook/shared';
import { createTestApp, newNote, type TestContext } from './helpers';

describe('Tags (e2e)', () => {
  let t: TestContext;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  const createNote = async (tags: string[]) =>
    noteSchema.parse((await t.agent.post('/notes').send(newNote({ tags })).expect(201)).body);
  const tags = async () =>
    tagListResponseSchema.parse((await t.agent.get('/tags').expect(200)).body).items;
  const byName = async (name: string) => (await tags()).find((x) => x.name === name)!;

  it('lists tags sorted by name with counts that exclude deleted notes; keeps 0-count tags', async () => {
    await createNote(['docker', 'linux']);
    const n2 = await createNote(['docker']);
    await t.agent.delete(`/notes/${n2.id}`).expect(204);
    const n3 = await createNote(['orphan']);
    await t.agent.delete(`/notes/${n3.id}`).expect(204);

    expect((await tags()).map(({ name, noteCount }) => ({ name, noteCount }))).toEqual([
      { name: 'docker', noteCount: 1 },
      { name: 'linux', noteCount: 1 },
      { name: 'orphan', noteCount: 0 },
    ]);
  });

  it('renames a tag (normalized), same name is a no-op', async () => {
    await createNote(['docker']);
    const tag = await byName('docker');
    const same = await t.agent.patch(`/tags/${tag.id}`).send({ name: ' Docker ' }).expect(200);
    expect(tagWithCountSchema.parse(same.body)).toEqual({ ...tag });
    const res = await t.agent.patch(`/tags/${tag.id}`).send({ name: 'Container' }).expect(200);
    expect(tagWithCountSchema.parse(res.body)).toEqual({
      id: tag.id,
      name: 'container',
      noteCount: 1,
    });
  });

  it('409 TAG_NAME_TAKEN with existing, then merge: true merges links', async () => {
    const n1 = await createNote(['k8s']);
    await createNote(['kubernetes']);
    const both = await createNote(['k8s', 'kubernetes']);
    const src = await byName('k8s');
    const dst = await byName('kubernetes');

    const conflict = await t.agent
      .patch(`/tags/${src.id}`)
      .send({ name: 'Kubernetes' })
      .expect(409);
    const err = tagNameTakenErrorSchema.parse(conflict.body);
    expect(err.existing).toEqual({ id: dst.id, name: 'kubernetes' });

    const merged = await t.agent
      .patch(`/tags/${src.id}`)
      .send({ name: 'kubernetes', merge: true })
      .expect(200);
    expect(tagWithCountSchema.parse(merged.body)).toEqual({
      id: dst.id,
      name: 'kubernetes',
      noteCount: 3,
    });
    expect((await tags()).map((x) => x.name)).toEqual(['kubernetes']);

    // Không tăng version của note liên quan; note có cả hai tag chỉ còn một liên kết.
    const n1After = noteSchema.parse((await t.agent.get(`/notes/${n1.id}`).expect(200)).body);
    expect(n1After).toMatchObject({ version: 1, tags: [{ id: dst.id, name: 'kubernetes' }] });
    const bothAfter = noteSchema.parse((await t.agent.get(`/notes/${both.id}`).expect(200)).body);
    expect(bothAfter.tags).toHaveLength(1);
  });

  it('DELETE removes the tag from every note (CASCADE)', async () => {
    const note = await createNote(['tmp', 'keep']);
    const tag = await byName('tmp');
    await t.agent.delete(`/tags/${tag.id}`).expect(204);
    const after = noteSchema.parse((await t.agent.get(`/notes/${note.id}`).expect(200)).body);
    expect(after.tags.map((x) => x.name)).toEqual(['keep']);
    expect(after.version).toBe(1);
    await t.agent.delete(`/tags/${tag.id}`).expect(404);
  });

  it('404 TAG_NOT_FOUND / 400 for bad ids and names', async () => {
    const res = await t.agent.patch(`/tags/${randomUUID()}`).send({ name: 'x' }).expect(404);
    expect(res.body.code).toBe('TAG_NOT_FOUND');
    await t.agent.patch('/tags/abc').send({ name: 'x' }).expect(400);
    await createNote(['a']);
    const tag = await byName('a');
    await t.agent.patch(`/tags/${tag.id}`).send({ name: '   ' }).expect(400);
  });

  it('notes sharing a new tag created concurrently do not duplicate the tag', async () => {
    await Promise.all([createNote(['race']), createNote(['race']), createNote(['Race'])]);
    expect(await byName('race')).toMatchObject({ noteCount: 3 });
    expect((await tags()).filter((x) => x.name === 'race')).toHaveLength(1);
  });
});
