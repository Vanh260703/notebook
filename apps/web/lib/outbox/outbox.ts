import {
  createNoteSchema,
  type CreateNoteInput,
  type Note,
  type UpdateNoteInput,
} from '@notebook/shared';
import { backoffMs, classifyError, errorInfo, type ErrorKind } from './classify';
import type { OutboxRecord, OutboxSource, OutboxStore } from './types';

/**
 * Hàng đợi note mới (PROJECT.md mục 5): ghi vào storage trước, gửi sau, chỉ xóa khi server đã có.
 * Thuần (không React, không IndexedDB), có test với store trong RAM.
 *
 * - Một vòng gửi tại một thời điểm trong một tab (single-flight). Hai tab cùng gửi một record vẫn
 *   an toàn: POST /notes idempotent theo id (201 rồi 200).
 * - Editor lưu lại khi note còn trong hàng: `replace` tăng `rev`. Xóa khỏi hàng bằng `deleteIfRev`
 *   (nguyên tử): rev đổi trong lúc POST đang bay thì giữ lại, ghi `created.version` và PATCH tiếp.
 * - Lỗi tạm thời: backoff 5 s → 5 phút, dừng vòng (server đang tắt thì record sau cũng lỗi).
 *   Hết phiên (401): giữ lại, bật `authRequired`. Lỗi vĩnh viễn: `failed`, gửi record kế tiếp.
 */
export interface OutboxApi {
  create(input: CreateNoteInput): Promise<Note>;
  update(id: string, input: UpdateNoteInput): Promise<Note>;
}

export interface OutboxDeps {
  store: OutboxStore;
  api: OutboxApi;
  now?: () => number;
  /** navigator.onLine; false thì không gửi (đợi sự kiện online). */
  isOnline?: () => boolean;
  /** Sau khi server đã có note, TRƯỚC khi xóa khỏi hàng (cập nhật cache, chờ danh sách tải lại). */
  afterSent?: (note: Note) => Promise<void> | void;
  /** Sau mỗi thay đổi do tab này gây ra (báo các tab khác đọc lại). */
  onLocalChange?: () => void;
}

export interface OutboxSnapshot {
  /** Sắp theo queuedAt (cũ trước). */
  records: readonly OutboxRecord[];
  authRequired: boolean;
}

export type SendResult =
  | { status: 'sent'; note: Note }
  | { status: 'queued'; error?: OutboxRecord['lastError'] }
  | { status: 'failed'; error: OutboxRecord['lastError'] };

export interface Outbox {
  getSnapshot(): OutboxSnapshot;
  subscribe(listener: () => void): () => void;
  /** Đọc lại storage (khi mở app, khi tab khác báo đổi). */
  load(): Promise<void>;
  /** Validate rồi ghi vào hàng và gửi ngay. id đã có trong hàng thì như `replace`. */
  enqueue(input: CreateNoteInput, source: OutboxSource): Promise<OutboxRecord>;
  /** Thay payload của note còn trong hàng (rev + 1). false nếu note đã rời hàng (đã lên server). */
  replace(id: string, input: CreateNoteInput): Promise<boolean>;
  /** `first`: gửi record này trước (editor bấm Lưu: không phải chờ các record cũ đang lỗi). */
  flush(opts?: { force?: boolean; first?: string }): Promise<void>;
  /** Gửi ngay một record và chờ kết quả (tối đa timeoutMs): editor dùng khi bấm Lưu. */
  sendNow(id: string, opts?: { timeoutMs?: number }): Promise<SendResult>;
  /** "Gửi lại": bỏ backoff và trạng thái failed. */
  retry(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  /** Note đã lên server và rời hàng. */
  onSent(listener: (note: Note) => void): () => void;
  dispose(): void;
}

type ErrorListener = (id: string, kind: ErrorKind, error: OutboxRecord['lastError']) => void;

/** CreateNoteInput → PATCH đủ mọi trường (nhánh `created`: POST đã xong, gửi bản mới nhất). */
export function toPatch(input: CreateNoteInput, version: number): UpdateNoteInput {
  const d = createNoteSchema.parse(input);
  return {
    version,
    title: d.title,
    content: d.content,
    type: d.type,
    status: d.status,
    entryDate: d.entryDate,
    pinned: d.pinned,
    tags: d.tags,
  };
}

const byQueuedAt = (a: OutboxRecord, b: OutboxRecord) =>
  a.queuedAt < b.queuedAt ? -1 : a.queuedAt > b.queuedAt ? 1 : 0;

export function createOutbox(deps: OutboxDeps): Outbox {
  const { store, api } = deps;
  const now = deps.now ?? (() => Date.now());
  const isOnline = deps.isOnline ?? (() => true);

  let snapshot: OutboxSnapshot = { records: [], authRequired: false };
  let authRequired = false;
  const listeners = new Set<() => void>();
  const sentListeners = new Set<(note: Note) => void>();
  const errorListeners = new Set<ErrorListener>();
  let running: Promise<void> | null = null;
  let again = false;
  let againForce = false;
  /** Record được ưu tiên trong vòng gửi tới (sendNow). */
  const priority = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const emit = () => listeners.forEach((l) => l());

  const refresh = async () => {
    const records = (await store.getAll()).sort(byQueuedAt);
    snapshot = { records, authRequired };
    emit();
  };

  const changed = async () => {
    await refresh();
    deps.onLocalChange?.();
  };

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  /** Hẹn lần gửi tới record pending sớm nhất (khi đang không phải chờ đăng nhập). */
  const scheduleNext = () => {
    clearTimer();
    if (disposed || authRequired) return;
    const pending = snapshot.records.filter((r) => r.state === 'pending');
    if (!pending.length) return;
    const at = Math.min(...pending.map((r) => r.nextAttemptAt));
    timer = setTimeout(() => void flush(), Math.max(0, at - now()));
  };

  type Outcome = 'next' | 'stop' | 'again';

  const sendOne = async (r: OutboxRecord): Promise<Outcome> => {
    const sentRev = r.rev;
    let note: Note;
    try {
      note = r.created
        ? await api.update(r.id, toPatch(r.input, r.created.version))
        : await api.create(r.input);
    } catch (e) {
      const kind = classifyError(e);
      const lastError = errorInfo(e);
      if (kind === 'permanent') {
        await store.update(r.id, (x) => ({ ...x, state: 'failed', lastError }));
      } else if (kind === 'auth') {
        authRequired = true;
        await store.update(r.id, (x) => ({ ...x, lastError }));
      } else {
        await store.update(r.id, (x) => {
          const attempts = x.attempts + 1;
          return { ...x, attempts, nextAttemptAt: now() + backoffMs(attempts), lastError };
        });
      }
      await changed();
      errorListeners.forEach((l) => l(r.id, kind, lastError));
      return kind === 'permanent' ? 'next' : 'stop';
    }

    authRequired = false;
    await deps.afterSent?.(note);
    if (await store.deleteIfRev(r.id, sentRev)) {
      await changed();
      sentListeners.forEach((l) => l(note));
      return 'next';
    }
    // rev đổi trong lúc gửi: server đã có note (version này), còn một PATCH với bản mới nhất.
    await store.update(r.id, (x) => ({
      ...x,
      created: { version: note.version },
      nextAttemptAt: 0,
      attempts: 0,
      lastError: null,
    }));
    await changed();
    return 'again';
  };

  const round = async (force: boolean) => {
    if (!isOnline()) return;
    const attempted = new Set<string>();
    for (;;) {
      if (disposed) return;
      const t = now();
      const next = (await store.getAll())
        .filter(
          (r) =>
            r.state === 'pending' &&
            !attempted.has(r.id) &&
            (force || priority.has(r.id) || r.nextAttemptAt <= t),
        )
        .sort(
          (a, b) => Number(priority.has(b.id)) - Number(priority.has(a.id)) || byQueuedAt(a, b),
        )[0];
      if (!next) return;
      attempted.add(next.id);
      priority.delete(next.id);
      const outcome = await sendOne(next);
      if (outcome === 'stop') return;
      if (outcome === 'again') attempted.delete(next.id);
    }
  };

  const flush = (opts?: { force?: boolean; first?: string }): Promise<void> => {
    const force = Boolean(opts?.force);
    if (opts?.first) priority.add(opts.first);
    if (running) {
      again = true;
      againForce ||= force;
      return running;
    }
    running = (async () => {
      try {
        let f = force;
        do {
          again = false;
          againForce = false;
          await round(f);
          f = againForce;
        } while (again && !disposed);
      } finally {
        running = null;
        await refresh().catch(() => undefined);
        scheduleNext();
      }
    })();
    return running;
  };

  const enqueue = async (input: CreateNoteInput, source: OutboxSource): Promise<OutboxRecord> => {
    // Lỗi dữ liệu thì báo ngay (ZodError), không để vào hàng.
    const parsed = createNoteSchema.parse(input);
    if (await replace(parsed.id, parsed)) {
      const r = (await store.getAll()).find((x) => x.id === parsed.id);
      if (r) return r;
    }
    const record: OutboxRecord = {
      id: parsed.id,
      input: parsed,
      queuedAt: new Date(now()).toISOString(),
      rev: 1,
      attempts: 0,
      nextAttemptAt: 0,
      state: 'pending',
      lastError: null,
      source,
    };
    await store.put(record);
    await changed();
    void flush({ first: record.id });
    return record;
  };

  const replace = async (id: string, input: CreateNoteInput): Promise<boolean> => {
    const parsed = createNoteSchema.parse(input);
    const ok = await store.update(id, (r) => ({
      ...r,
      input: parsed,
      rev: r.rev + 1,
      state: 'pending',
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
    }));
    if (!ok) return false;
    await changed();
    void flush({ first: id });
    return true;
  };

  const sendNow = (id: string, opts?: { timeoutMs?: number }): Promise<SendResult> =>
    new Promise<SendResult>((resolve) => {
      const record = snapshot.records.find((r) => r.id === id);
      let done = false;
      const finish = (res: SendResult) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        offSent();
        errorListeners.delete(onError);
        resolve(res);
      };
      const offSent = onSent((note) => note.id === id && finish({ status: 'sent', note }));
      const onError: ErrorListener = (rid, kind, error) => {
        if (rid !== id) return;
        finish(kind === 'permanent' ? { status: 'failed', error } : { status: 'queued', error });
      };
      errorListeners.add(onError);
      const t = setTimeout(() => finish({ status: 'queued' }), opts?.timeoutMs ?? 8000);
      if (!isOnline()) {
        finish({ status: 'queued', error: record?.lastError ?? null });
        return;
      }
      // Chỉ ưu tiên record này (không ép cả hàng): đã thử trong vòng đang chạy thì không thử lại.
      void flush({ first: id });
    });

  const onSent = (listener: (note: Note) => void) => {
    sentListeners.add(listener);
    return () => {
      sentListeners.delete(listener);
    };
  };

  const flushFn = flush;

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load: async () => {
      await refresh();
      scheduleNext();
    },
    enqueue,
    replace,
    flush: flushFn,
    sendNow,
    async retry(id) {
      authRequired = false;
      await store.update(id, (r) => ({
        ...r,
        state: 'pending',
        attempts: 0,
        nextAttemptAt: 0,
        lastError: null,
      }));
      await changed();
      await flush({ force: true });
    },
    async remove(id) {
      await store.delete(id);
      await changed();
    },
    async clear() {
      await store.clear();
      authRequired = false;
      await changed();
    },
    onSent,
    dispose() {
      disposed = true;
      clearTimer();
      listeners.clear();
      sentListeners.clear();
      errorListeners.clear();
    },
  };
}
