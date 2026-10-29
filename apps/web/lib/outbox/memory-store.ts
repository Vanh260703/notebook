import type { OutboxRecord, OutboxStore } from './types';

/** OutboxStore trong RAM (test). Mỗi thao tác là nguyên tử vì JS chạy một luồng. */
export function createMemoryStore(initial: OutboxRecord[] = []): OutboxStore & {
  records: Map<string, OutboxRecord>;
} {
  const records = new Map(initial.map((r) => [r.id, structuredClone(r)]));
  return {
    records,
    getAll: async () => [...records.values()].map((r) => structuredClone(r)),
    put: async (r) => {
      records.set(r.id, structuredClone(r));
    },
    delete: async (id) => {
      records.delete(id);
    },
    deleteIfRev: async (id, rev) => {
      const r = records.get(id);
      if (!r || r.rev !== rev) return false;
      records.delete(id);
      return true;
    },
    update: async (id, fn) => {
      const r = records.get(id);
      if (!r) return false;
      records.set(id, structuredClone(fn(structuredClone(r))));
      return true;
    },
    clear: async () => {
      records.clear();
    },
  };
}
