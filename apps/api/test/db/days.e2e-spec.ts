import { apiErrorSchema, dayCountsResponseSchema } from '@notebook/shared';
import { createTestApp, newNote, type TestContext } from './helpers';

describe('GET /days (e2e)', () => {
  let t: TestContext;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  const add = async (entryDate: string, over: Parameters<typeof newNote>[0] = {}) =>
    (
      await t.agent
        .post('/notes')
        .send(newNote({ entryDate, ...over }))
        .expect(201)
    ).body as {
      id: string;
    };
  const days = async (from: string, to: string) =>
    dayCountsResponseSchema.parse(
      (await t.agent.get(`/days?from=${from}&to=${to}`).expect(200)).body,
    );

  it('counts notes per day within the inclusive range; ARCHIVED counted, trashed not', async () => {
    await add('2026-09-30'); // ngoài khoảng
    await add('2026-10-01');
    await add('2026-10-15');
    await add('2026-10-15', { status: 'ARCHIVED' });
    const trashed = await add('2026-10-15');
    await t.agent.delete(`/notes/${trashed.id}`).expect(204);
    await add('2026-10-31');
    await add('2026-11-01'); // ngoài khoảng

    expect((await days('2026-10-01', '2026-10-31')).items).toEqual([
      { date: '2026-10-01', count: 1 },
      { date: '2026-10-15', count: 2 },
      { date: '2026-10-31', count: 1 },
    ]);
    expect((await days('2026-10-15', '2026-10-15')).items).toEqual([
      { date: '2026-10-15', count: 2 },
    ]);
  });

  it('empty range returns no items', async () => {
    await add('2026-10-01');
    expect(await days('2025-01-01', '2025-01-31')).toEqual({ items: [] });
  });

  it('400 VALIDATION_FAILED for from > to, too long ranges, bad or missing dates', async () => {
    for (const qs of [
      'from=2026-11-01&to=2026-10-01',
      'from=2026-01-01&to=2027-02-05',
      'from=2026-02-30&to=2026-03-01',
      'from=2026-02-01',
      '',
    ]) {
      const res = await t.agent.get(`/days?${qs}`).expect(400);
      expect(apiErrorSchema.parse(res.body).code).toBe('VALIDATION_FAILED');
    }
    const r = await t.agent.get('/days?from=2026-11-01&to=2026-10-01').expect(400);
    expect(r.body.issues).toEqual([{ path: 'to', message: 'from phải trước hoặc bằng to' }]);
    await t.agent.get('/days?from=2026-01-01&to=2027-02-04').expect(200);
  });

  it('401 without a session', async () => {
    await t.http().get('/days?from=2026-10-01&to=2026-10-31').expect(401);
  });
});
