import type { OutboxRecord, OutboxStore } from './types';

const DB_NAME = 'notebook';
const DB_VERSION = 1;
const STORE = 'outbox';

/**
 * OutboxStore trên IndexedDB, tự bọc bằng callback (không thêm idb/idb-keyval).
 * QUAN TRỌNG: trong một transaction không `await` promise nào khác. Safari tự commit transaction
 * khi có microtask chen giữa, deleteIfRev/update sẽ không còn nguyên tử. Mọi bước dùng onsuccess.
 *
 * Trả null nếu trình duyệt không có IndexedDB. Mở DB lỗi (chế độ riêng tư cũ, bị chặn) thì mọi
 * thao tác reject: nơi gọi tự chuyển sang gửi thẳng như GĐ1.
 */
export function createIdbStore(): OutboxStore | null {
  if (typeof indexedDB === 'undefined') return null;
  let dbPromise: Promise<IDBDatabase> | null = null;

  const open = (): Promise<IDBDatabase> => {
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      let req: IDBOpenDBRequest;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        reject(e);
        return;
      }
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // Tab khác mở phiên bản mới hơn: đóng để không chặn nó; lần sau tự mở lại.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB bị chặn bởi tab khác'));
    }).catch((e: unknown) => {
      dbPromise = null;
      throw e;
    });
    return dbPromise;
  };

  /** Chạy `body` trong một transaction; resolve khi transaction COMMIT xong (oncomplete). */
  const tx = async <T>(
    mode: IDBTransactionMode,
    body: (store: IDBObjectStore, set: (v: T) => void) => void,
  ): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      let result: T;
      const t = db.transaction(STORE, mode);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error ?? new Error('Transaction bị hủy'));
      body(t.objectStore(STORE), (v) => {
        result = v;
      });
    });
  };

  return {
    getAll: () =>
      tx<OutboxRecord[]>('readonly', (s, set) => {
        const req = s.getAll();
        req.onsuccess = () => set(req.result as OutboxRecord[]);
      }),
    put: (r) => tx<void>('readwrite', (s) => void s.put(r)),
    delete: (id) => tx<void>('readwrite', (s) => void s.delete(id)),
    deleteIfRev: (id, rev) =>
      tx<boolean>('readwrite', (s, set) => {
        set(false);
        const req = s.get(id);
        req.onsuccess = () => {
          const r = req.result as OutboxRecord | undefined;
          if (r && r.rev === rev) {
            s.delete(id);
            set(true);
          }
        };
      }),
    update: (id, fn) =>
      tx<boolean>('readwrite', (s, set) => {
        set(false);
        const req = s.get(id);
        req.onsuccess = () => {
          const r = req.result as OutboxRecord | undefined;
          if (!r) return;
          s.put(fn(r));
          set(true);
        };
      }),
    clear: () => tx<void>('readwrite', (s) => void s.clear()),
  };
}
