import type { CreateNoteInput, Note } from '@notebook/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { createMemoryStore } from './memory-store';
import { createOutbox, type OutboxApi } from './outbox';
import { countOutbox, withSentNotice } from './sent-notice';
import type { OutboxRecord } from './types';

const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const ID3 = '33333333-3333-4333-8333-333333333333';

const input = (id: string): CreateNoteInput => ({
  id,
  entryDate: '2026-10-27',
  title: 't',
  content: 'c',
  type: 'LEARNING',
  status: 'INBOX',
  pinned: false,
  tags: [],
});

const noteOf = (i: CreateNoteInput): Note => ({
  id: i.id,
  title: i.title ?? '',
  content: i.content ?? '',
  type: 'LEARNING',
  status: 'INBOX',
  entryDate: '2026-10-27',
  pinned: false,
  version: 1,
  createdAt: '2026-10-27T01:00:00.000Z',
  updatedAt: '2026-10-27T01:00:00.000Z',
  deletedAt: null,
  tags: [],
});

const rec = (
  id: string,
  minute: number,
  state: OutboxRecord['state'] = 'pending',
): OutboxRecord => ({
  id,
  input: input(id),
  queuedAt: `2026-10-27T07:0${minute}:00.000Z`,
  rev: 1,
  attempts: 1,
  nextAttemptAt: 0,
  state,
  lastError: null,
  source: 'capture',
});

const networkError = () => new ApiError(0, { statusCode: 0, code: 'NETWORK', message: 'offline' });
const badRequest = () => new ApiError(400, { statusCode: 400, code: 'VALIDATION', message: 'bad' });

function setup(initial: OutboxRecord[] = []) {
  const store = createMemoryStore(initial);
  const api = {
    create: vi.fn<OutboxApi['create']>(async (i) => noteOf(i)),
    update: vi.fn<OutboxApi['update']>(),
  };
  const notify = vi.fn<(n: number) => void>();
  const ob = withSentNotice(createOutbox({ store, api }), notify);
  return { store, api, notify, ob };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

describe('countOutbox', () => {
  it('separates pending from failed', () => {
    expect(countOutbox([])).toEqual({ unsent: 0, pending: 0, failed: 0 });
    expect(countOutbox([rec(ID1, 1), rec(ID2, 2, 'failed'), rec(ID3, 3)])).toEqual({
      unsent: 3,
      pending: 2,
      failed: 1,
    });
  });
});

describe('withSentNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T08:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('notifies once with the count when queued notes are sent in the background', async () => {
    const { ob, notify, store } = setup([rec(ID1, 1), rec(ID2, 2)]);
    await ob.load();
    await ob.flush({ force: true });
    await settle();
    expect(store.records.size).toBe(0);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(2);
    // Không báo lại ở các lần đổi snapshot sau.
    await ob.load();
    await settle();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('does not notify for a note whose sendNow is awaiting (the caller shows its own toast)', async () => {
    const { ob, notify, store } = setup();
    await ob.enqueue(input(ID1), 'capture');
    const res = await ob.sendNow(ID1, { timeoutMs: 4000 });
    await settle();
    expect(res.status).toBe('sent');
    expect(store.records.size).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('counts a note sent later in the background after its sendNow timed out', async () => {
    const { ob, notify, api } = setup();
    api.create.mockRejectedValue(networkError());
    await ob.enqueue(input(ID1), 'capture');
    const res = await ob.sendNow(ID1, { timeoutMs: 4000 });
    expect(res.status).toBe('queued');
    expect(notify).not.toHaveBeenCalled();
    api.create.mockImplementation(async (i) => noteOf(i));
    await ob.flush({ force: true });
    await settle();
    expect(notify).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('counts only the background notes when a foreground save empties the queue', async () => {
    const { ob, notify, api } = setup([rec(ID1, 1)]);
    await ob.load();
    await ob.enqueue(input(ID2), 'capture'); // gửi ID2 trước (ưu tiên), rồi ID1
    await ob.sendNow(ID2);
    await settle();
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('a failed record does not block the notice', async () => {
    const { ob, notify, api, store } = setup([rec(ID1, 1), rec(ID2, 2)]);
    api.create.mockImplementation(async (i) => {
      if (i.id === ID2) throw badRequest();
      return noteOf(i);
    });
    await ob.load();
    await ob.flush({ force: true });
    await settle();
    expect(store.records.get(ID2)?.state).toBe('failed');
    expect(notify).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('does not notify when the queue empties because of remove', async () => {
    const { ob, notify, api } = setup([rec(ID1, 1), rec(ID2, 2)]);
    // ID1 lên server, ID2 lỗi mạng (còn chờ): chưa báo.
    api.create.mockImplementation(async (i) => {
      if (i.id === ID2) throw networkError();
      return noteOf(i);
    });
    await ob.load();
    await ob.flush({ force: true });
    await settle();
    expect(notify).not.toHaveBeenCalled();
    await ob.remove(ID2);
    await settle();
    expect(notify).not.toHaveBeenCalled();
    // Số đã đếm bị bỏ: lần gửi nền sau chỉ báo note của lần đó.
    api.create.mockImplementation(async (i) => noteOf(i));
    await enqueueInBackground(ob, ID3);
    await settle();
    expect(notify).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('does not notify on clear (logout)', async () => {
    const { ob, notify, api } = setup([rec(ID1, 1), rec(ID2, 2)]);
    api.create.mockImplementation(async (i) => {
      if (i.id === ID2) throw networkError();
      return noteOf(i);
    });
    await ob.load();
    await ob.flush({ force: true });
    await ob.clear();
    await settle();
    expect(ob.getSnapshot().records).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });
});

/** Note vào hàng rồi được gửi ở nền (không có sendNow chờ kết quả). */
async function enqueueInBackground(ob: ReturnType<typeof withSentNotice>, id: string) {
  await ob.enqueue(input(id), 'capture');
  await ob.flush({ force: true });
}
