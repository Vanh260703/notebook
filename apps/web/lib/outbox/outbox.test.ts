import type { CreateNoteInput, Note, UpdateNoteInput } from '@notebook/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { createMemoryStore } from './memory-store';
import { createOutbox, type OutboxApi } from './outbox';

const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const ID3 = '33333333-3333-4333-8333-333333333333';

const input = (id: string, title = 't'): CreateNoteInput => ({
  id,
  entryDate: '2026-10-27',
  title,
  content: 'c',
});

const noteOf = (i: CreateNoteInput | (UpdateNoteInput & { id: string }), version = 1): Note => ({
  id: i.id,
  title: i.title ?? '',
  content: i.content ?? '',
  type: 'LEARNING',
  status: 'INBOX',
  entryDate: '2026-10-27',
  pinned: false,
  version,
  createdAt: '2026-10-27T01:00:00.000Z',
  updatedAt: '2026-10-27T01:00:00.000Z',
  deletedAt: null,
  tags: [],
});

const apiError = (status: number, code = 'X') =>
  new ApiError(status, { statusCode: status, code, message: `HTTP ${status}` });
const networkError = () => apiError(0, 'NETWORK');

function fakeApi() {
  const api = {
    create: vi.fn<OutboxApi['create']>(async (i) => noteOf(i)),
    update: vi.fn<OutboxApi['update']>(async (id, i) => noteOf({ ...i, id }, i.version + 1)),
  };
  return api;
}

/** Cho các promise đang chờ chạy xong (không đẩy đồng hồ). */
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('outbox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T08:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('enqueue → sends → removes the record, notifies onSent and afterSent first', async () => {
    const store = createMemoryStore();
    const api = fakeApi();
    const order: string[] = [];
    const ob = createOutbox({
      store,
      api,
      afterSent: () => {
        order.push(`afterSent:${store.records.has(ID1)}`);
      },
    });
    ob.onSent((n) => order.push(`sent:${n.id === ID1}`));
    await ob.enqueue(input(ID1), 'capture');
    await settle();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(store.records.size).toBe(0);
    expect(ob.getSnapshot().records).toEqual([]);
    // Server có note (danh sách tải lại) TRƯỚC khi rời hàng.
    expect(order).toEqual(['afterSent:true', 'sent:true']);
  });

  it('rejects invalid input before queueing', async () => {
    const store = createMemoryStore();
    const ob = createOutbox({ store, api: fakeApi() });
    await expect(
      ob.enqueue({ ...input(ID1), entryDate: '2026-02-30' }, 'capture'),
    ).rejects.toThrow();
    expect(store.records.size).toBe(0);
  });

  it('network error keeps the record and backs off 5/10/20 s, capped at 5 minutes', async () => {
    const store = createMemoryStore();
    const api = fakeApi();
    api.create.mockRejectedValue(networkError());
    const ob = createOutbox({ store, api });
    await ob.enqueue(input(ID1), 'capture');
    await settle();
    expect(api.create).toHaveBeenCalledTimes(1);
    const r = store.records.get(ID1)!;
    expect(r).toMatchObject({ state: 'pending', attempts: 1 });
    expect(r.nextAttemptAt - Date.now()).toBe(5_000);
    expect(r.lastError).toMatchObject({ status: 0, code: 'NETWORK' });

    await vi.advanceTimersByTimeAsync(4_999);
    expect(api.create).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(store.records.get(ID1)!.nextAttemptAt - Date.now()).toBe(10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.create).toHaveBeenCalledTimes(3);
    expect(store.records.get(ID1)!.nextAttemptAt - Date.now()).toBe(20_000);

    // Nhiều lần sau: không quá 5 phút.
    for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(store.records.get(ID1)!.nextAttemptAt - Date.now()).toBeLessThanOrEqual(5 * 60_000);
    expect(store.records.get(ID1)!.nextAttemptAt - Date.now()).toBe(5 * 60_000);

    // Có mạng lại: lần hẹn kế tiếp gửi được và record rời hàng.
    api.create.mockImplementation(async (i) => noteOf(i));
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(store.records.size).toBe(0);
  });

  it('400 marks the record failed and still sends the next one; 5xx stops the round', async () => {
    const store = createMemoryStore();
    const api = fakeApi();
    api.create.mockImplementation(async (i) => {
      if (i.id === ID1) throw apiError(400, 'VALIDATION_FAILED');
      return noteOf(i);
    });
    const ob = createOutbox({ store, api });
    await store.put({ ...rec(ID1), queuedAt: '2026-10-27T07:00:00.000Z' });
    await store.put({ ...rec(ID2), queuedAt: '2026-10-27T07:01:00.000Z' });
    await ob.flush({ force: true });
    expect(store.records.get(ID1)).toMatchObject({ state: 'failed' });
    expect(store.records.get(ID1)!.lastError?.code).toBe('VALIDATION_FAILED');
    expect(store.records.has(ID2)).toBe(false);

    // 5xx: dừng vòng, record sau chưa được gửi.
    api.create.mockClear();
    api.create.mockRejectedValue(apiError(502));
    await store.put({ ...rec(ID2), queuedAt: '2026-10-27T07:02:00.000Z' });
    await store.put({ ...rec(ID3), queuedAt: '2026-10-27T07:03:00.000Z' });
    await ob.flush({ force: true });
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create.mock.calls[0]?.[0].id).toBe(ID2);
    expect(store.records.get(ID3)).toMatchObject({ attempts: 0 });
  });

  it('401 keeps the record and sets authRequired (no retry timer)', async () => {
    const store = createMemoryStore();
    const api = fakeApi();
    api.create.mockRejectedValue(apiError(401, 'UNAUTHORIZED'));
    const ob = createOutbox({ store, api });
    await ob.enqueue(input(ID1), 'capture');
    await settle();
    expect(ob.getSnapshot().authRequired).toBe(true);
    expect(store.records.get(ID1)).toMatchObject({ state: 'pending' });
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(api.create).toHaveBeenCalledTimes(1);
    // Đăng nhập lại rồi "Gửi lại".
    api.create.mockImplementation(async (i) => noteOf(i));
    await ob.retry(ID1);
    expect(ob.getSnapshot().authRequired).toBe(false);
    expect(store.records.size).toBe(0);
  });

  it('replace while the POST is in flight → keeps the record and PATCHes with the new version', async () => {
    const store = createMemoryStore();
    const api = fakeApi();
    let resolvePost!: (n: Note) => void;
    api.create.mockImplementationOnce(() => new Promise<Note>((r) => (resolvePost = r)));
    const sent: Note[] = [];
    const ob = createOutbox({ store, api });
    ob.onSent((n) => sent.push(n));

    await ob.enqueue(input(ID1, 'v1'), 'editor');
    await settle();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(await ob.replace(ID1, input(ID1, 'v2'))).toBe(true);
    expect(store.records.get(ID1)!.rev).toBe(2);

    resolvePost(noteOf(input(ID1, 'v1'), 1)); // server có v1, version 1
    await settle();
    expect(api.update).toHaveBeenCalledTimes(1);
    const [id, patch] = api.update.mock.calls[0]!;
    expect(id).toBe(ID1);
    expect(patch).toMatchObject({ version: 1, title: 'v2' });
    expect(store.records.size).toBe(0);
    // onSent chỉ khi record rời hàng, với bản cuối cùng.
    expect(sent.map((n) => [n.title, n.version])).toEqual([['v2', 2]]);
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it('replace returns false once the note has left the queue', async () => {
    const store = createMemoryStore();
    const ob = createOutbox({ store, api: fakeApi() });
    await ob.enqueue(input(ID1), 'editor');
    await settle();
    expect(await ob.replace(ID1, input(ID1, 'later'))).toBe(false);
  });

  it('two concurrent flush calls run a single round', async () => {
    const store = createMemoryStore([rec(ID1)]);
    const api = fakeApi();
    let resolvePost!: (n: Note) => void;
    api.create.mockImplementationOnce(() => new Promise<Note>((r) => (resolvePost = r)));
    const ob = createOutbox({ store, api });
    const a = ob.flush({ force: true });
    const b = ob.flush({ force: true });
    expect(a).toBe(b);
    await settle();
    resolvePost(noteOf(input(ID1)));
    await a;
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(store.records.size).toBe(0);
  });

  it('sends in queuedAt order', async () => {
    const store = createMemoryStore([
      { ...rec(ID3), queuedAt: '2026-10-27T07:03:00.000Z' },
      { ...rec(ID1), queuedAt: '2026-10-27T07:01:00.000Z' },
      { ...rec(ID2), queuedAt: '2026-10-27T07:02:00.000Z' },
    ]);
    const api = fakeApi();
    const ob = createOutbox({ store, api });
    await ob.flush({ force: true });
    expect(api.create.mock.calls.map((c) => c[0].id)).toEqual([ID1, ID2, ID3]);
  });

  it('does not send while offline; skips records still backing off unless forced', async () => {
    const store = createMemoryStore([{ ...rec(ID1), nextAttemptAt: Date.now() + 60_000 }]);
    const api = fakeApi();
    let online = false;
    const ob = createOutbox({ store, api, isOnline: () => online });
    await ob.flush({ force: true });
    expect(api.create).not.toHaveBeenCalled();
    online = true;
    await ob.flush();
    expect(api.create).not.toHaveBeenCalled();
    await ob.flush({ force: true });
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it('retry resets backoff and failed state; remove deletes', async () => {
    const store = createMemoryStore([
      { ...rec(ID1), state: 'failed', attempts: 4, nextAttemptAt: Date.now() + 99_000 },
      rec(ID2),
    ]);
    const api = fakeApi();
    api.create.mockRejectedValue(networkError());
    const ob = createOutbox({ store, api });
    await ob.retry(ID1);
    expect(store.records.get(ID1)).toMatchObject({ state: 'pending', attempts: 1 });
    expect(store.records.get(ID1)!.nextAttemptAt - Date.now()).toBe(5_000);
    await ob.remove(ID2);
    expect(store.records.has(ID2)).toBe(false);
    expect(ob.getSnapshot().records.map((r) => r.id)).toEqual([ID1]);
  });

  it('sendNow resolves sent / queued (transient or timeout) / failed', async () => {
    const store = createMemoryStore();
    const api = fakeApi();
    const ob = createOutbox({ store, api });

    await store.put(rec(ID1));
    await ob.load();
    await expect(ob.sendNow(ID1)).resolves.toMatchObject({ status: 'sent' });

    api.create.mockRejectedValueOnce(networkError());
    await store.put(rec(ID2));
    await ob.load();
    await expect(ob.sendNow(ID2)).resolves.toMatchObject({ status: 'queued' });

    await ob.remove(ID2);
    api.create.mockRejectedValueOnce(apiError(400, 'VALIDATION_FAILED'));
    await store.put(rec(ID3));
    await ob.load();
    await expect(ob.sendNow(ID3)).resolves.toMatchObject({ status: 'failed' });
  });

  it('sendNow tries its own record first (older records failing must not delay it)', async () => {
    const store = createMemoryStore([
      { ...rec(ID1), queuedAt: '2026-10-27T07:00:00.000Z' },
      { ...rec(ID2), queuedAt: '2026-10-27T07:05:00.000Z' },
    ]);
    const api = fakeApi();
    api.create.mockRejectedValue(apiError(503));
    const ob = createOutbox({ store, api });
    await ob.load();
    await expect(ob.sendNow(ID2, { timeoutMs: 60_000 })).resolves.toMatchObject({
      status: 'queued',
    });
    expect(api.create.mock.calls[0]?.[0].id).toBe(ID2);
  });

  it('sendNow times out to queued when the server hangs', async () => {
    const store = createMemoryStore([rec(ID1)]);
    const api = fakeApi();
    api.create.mockImplementation(() => new Promise<Note>(() => undefined));
    const ob = createOutbox({ store, api });
    await ob.load();
    const p = ob.sendNow(ID1, { timeoutMs: 8_000 });
    await vi.advanceTimersByTimeAsync(8_000);
    await expect(p).resolves.toEqual({ status: 'queued' });
  });

  it('two tabs sending the same record do not create duplicates (idempotent POST)', async () => {
    // Hai tab dùng chung storage (IndexedDB) nhưng mỗi tab một outbox.
    const store = createMemoryStore([rec(ID1)]);
    const serverIds = new Set<string>();
    const api = fakeApi();
    api.create.mockImplementation(async (i) => {
      serverIds.add(i.id);
      return noteOf(i);
    });
    const tabA = createOutbox({ store, api });
    const tabB = createOutbox({ store, api });
    await Promise.all([tabA.flush({ force: true }), tabB.flush({ force: true })]);
    expect(serverIds.size).toBe(1);
    expect(store.records.size).toBe(0);
  });
});

function rec(id: string) {
  return {
    id,
    input: {
      ...input(id),
      title: 't',
      content: 'c',
      type: 'LEARNING',
      status: 'INBOX',
      pinned: false,
      tags: [],
    } as CreateNoteInput,
    queuedAt: '2026-10-27T07:00:00.000Z',
    rev: 1,
    attempts: 0,
    nextAttemptAt: 0,
    state: 'pending' as const,
    lastError: null,
    source: 'capture' as const,
  };
}
