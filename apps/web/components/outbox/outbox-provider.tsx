'use client';

import type { CreateNoteInput, Note } from '@notebook/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { afterNoteSaved } from '@/components/notes/use-note-actions';
import { createNote, updateNote } from '@/lib/api/notes';
import { createIdbStore } from '@/lib/outbox/idb-store';
import {
  createOutbox,
  type Outbox,
  type OutboxSnapshot,
  type SendResult,
} from '@/lib/outbox/outbox';
import { countOutbox, withSentNotice } from '@/lib/outbox/sent-notice';
import type { OutboxRecord, OutboxSource } from '@/lib/outbox/types';
import { qk } from '@/lib/query-keys';

const CHANNEL = 'nb-outbox';
const EMPTY: OutboxSnapshot = { records: [], authRequired: false };
const noopSubscribe = () => () => undefined;

const OutboxContext = createContext<Outbox | null>(null);

/**
 * Mỗi tab một outbox (IndexedDB dùng chung). Gửi khi: mở app, sự kiện `online`, tab hiện lại,
 * ngay sau enqueue/replace, "Gửi lại", và theo backoff. BroadcastChannel chỉ báo tab khác đọc lại.
 * Gắn trong (app)/layout, không gắn ở trang login.
 */
export function OutboxProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [outbox, setOutbox] = useState<Outbox | null>(null);

  useEffect(() => {
    const store = createIdbStore();
    if (!store) return;
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
    const base = createOutbox({
      store,
      // redirectOn401: false: gửi nền gặp 401 không được chuyển trang giữa lúc đang gõ.
      api: {
        create: (input) => createNote(input, { redirectOn401: false }),
        update: (id, input) => updateNote(id, input, { redirectOn401: false }),
      },
      isOnline: () => navigator.onLine !== false,
      afterSent: async (note) => {
        afterNoteSaved(qc, note);
        // Danh sách trên server có note TRƯỚC khi rời hàng: không nhấp nháy, không mất dòng.
        // Chờ tối đa 2 s: server vừa tắt thì refetch (kèm retry) không được giữ record lâu.
        await Promise.race([
          qc.invalidateQueries({ queryKey: qk.noteLists }),
          new Promise((r) => setTimeout(r, 2000)),
        ]);
      },
      onLocalChange: () => channel?.postMessage('changed'),
    });
    const ob = withSentNotice(base, (n) => toast.success(`Đã gửi ${n} note chờ lên server`));
    if (channel) channel.onmessage = () => void ob.load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- outbox chỉ tạo được ở client (IndexedDB).
    setOutbox(ob);

    const flush = () => void ob.flush({ force: true });
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void ob.load().then(flush);
    };
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', onVisible);
    void ob
      .load()
      .then(flush)
      .catch(() => undefined);
    return () => {
      window.removeEventListener('online', flush);
      document.removeEventListener('visibilitychange', onVisible);
      channel?.close();
      ob.dispose();
    };
  }, [qc]);

  return <OutboxContext.Provider value={outbox}>{children}</OutboxContext.Provider>;
}

export interface UseOutbox {
  /** Outbox sẵn sàng (IndexedDB có). false: nơi gọi gửi thẳng như GĐ1. */
  available: boolean;
  records: readonly OutboxRecord[];
  /** Số note chưa lên server (chờ gửi + gửi lỗi): badge Inbox, hỏi lại khi đăng xuất. */
  unsentCount: number;
  /** Số note outbox đang tự gửi lại (state pending). */
  pendingCount: number;
  /** Số note gửi lỗi vĩnh viễn, cần xử lý tay ở Inbox. */
  failedCount: number;
  authRequired: boolean;
  enqueue: (input: CreateNoteInput, source: OutboxSource) => Promise<OutboxRecord>;
  replace: (id: string, input: CreateNoteInput) => Promise<boolean>;
  sendNow: (id: string, opts?: { timeoutMs?: number }) => Promise<SendResult>;
  retry: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  onSent: (listener: (note: Note) => void) => () => void;
}

const unavailable = () => Promise.reject(new Error('Outbox chưa sẵn sàng'));

export function useOutbox(): UseOutbox {
  const ob = useContext(OutboxContext);
  const snap = useSyncExternalStore(
    ob?.subscribe ?? noopSubscribe,
    ob?.getSnapshot ?? (() => EMPTY),
    () => EMPTY,
  );
  const counts = countOutbox(snap.records);
  return {
    available: ob !== null,
    records: snap.records,
    unsentCount: counts.unsent,
    pendingCount: counts.pending,
    failedCount: counts.failed,
    authRequired: snap.authRequired,
    enqueue: ob ? ob.enqueue : unavailable,
    replace: ob ? ob.replace : unavailable,
    sendNow: ob ? ob.sendNow : unavailable,
    retry: ob ? ob.retry : unavailable,
    remove: ob ? ob.remove : unavailable,
    clear: ob ? ob.clear : async () => undefined,
    onSent: ob ? ob.onSent : () => () => undefined,
  };
}
