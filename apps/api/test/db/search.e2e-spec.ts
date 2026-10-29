import {
  HIGHLIGHT_END as E,
  HIGHLIGHT_START as S,
  noteListResponseSchema,
  noteSchema,
  type Note,
} from '@notebook/shared';
import { DataSource } from 'typeorm';
import { createTestApp, newNote, type TestContext } from './helpers';

describe('Search (e2e)', () => {
  let t: TestContext;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  const create = async (over: Parameters<typeof newNote>[0] = {}): Promise<Note> =>
    noteSchema.parse((await t.agent.post('/notes').send(newNote(over)).expect(201)).body);

  const search = async (q: string, extra = '') =>
    noteListResponseSchema.parse(
      (await t.agent.get(`/notes?q=${encodeURIComponent(q)}${extra}`).expect(200)).body,
    );
  const ids = async (q: string, extra = '') => (await search(q, extra)).items.map((i) => i.id);

  it('migration created the vn_unaccent text search configuration', async () => {
    const rows = await t.app
      .get(DataSource)
      .query(`SELECT 1 FROM pg_ts_config WHERE cfgname = 'vn_unaccent'`);
    expect(rows).toHaveLength(1);
  });

  it('ignores diacritics on both sides', async () => {
    const a = await create({ title: 'Đường về nhà', content: '' });
    const b = await create({ title: 'duong khong dau', content: '' });
    expect((await ids('duong')).sort()).toEqual([a.id, b.id].sort());
    expect((await ids('đường')).sort()).toEqual([a.id, b.id].sort());
    expect(await ids('Đuờng')).toHaveLength(2); // gõ sai vị trí dấu vẫn ra (bỏ dấu cả hai phía)
  });

  it('matches word prefixes and requires every term ("dock vol")', async () => {
    const both = await create({ title: 'Lỗi Docker volume', content: 'mount bị trống' });
    await create({ title: 'Chỉ có Docker', content: 'không có từ kia' });
    expect(await ids('dock vol')).toEqual([both.id]);
  });

  it('finds parts of code tokens: file names, packages, camelCase, dotted names', async () => {
    const orm = await create({ title: 'ORM', content: 'cài @nestjs/typeorm rồi' });
    const compose = await create({ title: 'Compose', content: 'sửa docker-compose.yml' });
    const rq = await create({ title: 'Hook', content: 'dùng useQuery của TanStack' });
    const node = await create({ title: 'Runtime', content: 'node.js 22' });
    expect(await ids('typeorm')).toEqual([orm.id]);
    expect(await ids('compose')).toContain(compose.id);
    expect(await ids('query')).toEqual([rq.id]);
    expect(await ids('usequery')).toEqual([rq.id]);
    expect(await ids('node.js')).toEqual([node.id]);
    expect(await ids('docker-compose.yml')).toEqual([compose.id]);
  });

  it('ranks title matches above content matches, ignoring pinned', async () => {
    const inContent = await create({
      title: 'Ghi chú',
      content: 'nói về kubernetes',
      pinned: true,
    });
    const inTitle = await create({ title: 'Kubernetes cơ bản', content: 'pod' });
    expect(await ids('kube')).toEqual([inTitle.id, inContent.id]);
  });

  it('a title match stays above a long note repeating the words in its content', async () => {
    const long = await create({
      title: 'Dựng server',
      content: 'docker volume '.repeat(40),
    });
    const titled = await create({ title: 'Lỗi Docker volume', content: 'ngắn' });
    expect(await ids('docker volume')).toEqual([titled.id, long.id]);
    // Chỉ một từ khớp tiêu đề: chưa đủ để tính là khớp tiêu đề.
    const half = await create({ title: 'Docker thôi', content: 'volume' });
    expect((await ids('docker volume'))[0]).toBe(titled.id);
    expect(await ids('docker volume')).toContain(half.id);
  });

  it('combines with filters; excludes trashed by default; includes ARCHIVED', async () => {
    const learn = await create({ title: 'redis a', tags: ['db'], entryDate: '2026-10-20' });
    const personal = await create({ title: 'redis b', type: 'PERSONAL', status: 'ACTIVE' });
    const archived = await create({ title: 'redis c', status: 'ARCHIVED' });
    const trashed = await create({ title: 'redis d' });
    await t.agent.delete(`/notes/${trashed.id}`).expect(204);

    expect((await ids('redis')).sort()).toEqual([learn.id, personal.id, archived.id].sort());
    expect(await ids('redis', '&type=PERSONAL')).toEqual([personal.id]);
    expect(await ids('redis', '&status=ACTIVE')).toEqual([personal.id]);
    expect(await ids('redis', '&tag=db')).toEqual([learn.id]);
    expect(await ids('redis', '&date=2026-10-20')).toEqual([learn.id]);
    expect(await ids('redis', '&trashed=true')).toEqual([trashed.id]);
    expect((await ids('redis', '&excludeArchived=true')).sort()).toEqual(
      [learn.id, personal.id].sort(),
    );
  });

  it('returns highlights that keep the original diacritics', async () => {
    await create({
      title: 'Đường dẫn Docker',
      content: 'Hôm nay sửa lỗi Docker volume trên đường về nhà, rồi đi ngủ.',
    });
    const [item] = (await search('duong dock')).items;
    expect(item?.highlight?.title).toBe(`${S}Đường${E} dẫn ${S}Docker${E}`);
    expect(item?.highlight?.snippet).toContain(`${S}đường${E}`);
    expect(item?.highlight?.snippet).toContain(`${S}Docker${E}`);
    expect(item?.excerpt).toContain('Hôm nay');

    // Không có q thì không có highlight.
    const plain = noteListResponseSchema.parse((await t.agent.get('/notes').expect(200)).body);
    expect(plain.items[0]).not.toHaveProperty('highlight');
  });

  it('paginates search results without duplicates', async () => {
    for (let i = 0; i < 5; i++) await create({ title: `sqlite ${i}` });
    const p1 = await search('sqlite', '&limit=2&page=1');
    const p2 = await search('sqlite', '&limit=2&page=2');
    const p3 = await search('sqlite', '&limit=2&page=3');
    expect(p1).toMatchObject({ total: 5, hasMore: true });
    expect(p3).toMatchObject({ total: 5, hasMore: false });
    const all = [...p1.items, ...p2.items, ...p3.items].map((i) => i.id);
    expect(new Set(all).size).toBe(5);
  });

  it('never fails on odd input: punctuation only, tsquery syntax, too long', async () => {
    await create({ title: 'a b' });
    expect(await search('!!!')).toMatchObject({ items: [], total: 0, hasMore: false });
    expect(await search('🔥')).toMatchObject({ total: 0 });
    await t.agent.get(`/notes?q=${encodeURIComponent("a' | b:*\\(")}`).expect(200);
    await t.agent.get(`/notes?q=${encodeURIComponent("'':*")}`).expect(200);
    const tooLong = await t.agent.get(`/notes?q=${'a'.repeat(201)}`).expect(400);
    expect(tooLong.body.code).toBe('VALIDATION_FAILED');
  });

  it('excludeArchived=true without q hides ARCHIVED and the total matches', async () => {
    await create({ status: 'ARCHIVED' });
    await create({ status: 'ACTIVE' });
    await create();
    const res = noteListResponseSchema.parse(
      (await t.agent.get('/notes?excludeArchived=true').expect(200)).body,
    );
    expect(res.total).toBe(2);
    expect(res.items.every((i) => i.status !== 'ARCHIVED')).toBe(true);
    const archivedOnly = noteListResponseSchema.parse(
      (await t.agent.get('/notes?excludeArchived=true&status=ARCHIVED').expect(200)).body,
    );
    expect(archivedOnly.total).toBe(0);
  });

  it('401 without a session', async () => {
    await t.http().get('/notes?q=x').expect(401);
  });
});
