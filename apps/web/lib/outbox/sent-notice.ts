import type { Outbox } from './outbox';
import type { OutboxRecord } from './types';

/** Số note chưa lên server, tách "đang chờ tự gửi" khỏi "gửi lỗi, cần xử lý tay". */
export interface OutboxCounts {
  /** Mọi record (chờ + lỗi): badge Inbox, hỏi lại khi đăng xuất. */
  unsent: number;
  /** state = 'pending': outbox tự gửi lại. */
  pending: number;
  /** state = 'failed': lỗi vĩnh viễn, cần người dùng xử lý ở Inbox. */
  failed: number;
}

export function countOutbox(records: readonly OutboxRecord[]): OutboxCounts {
  const failed = records.filter((r) => r.state === 'failed').length;
  return { unsent: records.length, pending: records.length - failed, failed };
}

/**
 * Bọc outbox để báo "Đã gửi N note chờ lên server" MỘT lần khi các note chờ được gửi ở nền
 * (có mạng lại, server bật lại, "Gửi lại") và hàng không còn note nào đang chờ.
 * - Note đang có `sendNow` chờ kết quả (ô ghi nhanh, editor) không tính: nơi gọi tự báo.
 *   `sendNow` luôn được gọi ngay sau enqueue/replace, trước khi request kịp có phản hồi.
 * - Hàng hết note chờ vì `remove`/`clear` thì không báo (và bỏ số đã đếm).
 * - Record lỗi (`failed`) không chặn thông báo: chúng đã hiện riêng, màu đỏ.
 *
 * Đếm ở `onSent`, quyết định báo hay không ở lần đổi snapshot, lùi một tick (setTimeout 0):
 * outbox phát snapshot mới TRƯỚC khi gọi listener `onSent` của cùng record đó.
 */
export function withSentNotice(ob: Outbox, notify: (count: number) => void): Outbox {
  let count = 0;
  /** id → số lần sendNow đang chờ. */
  const foreground = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const pendingLeft = () => countOutbox(ob.getSnapshot().records).pending;

  const check = () => {
    timer = null;
    if (count === 0 || pendingLeft() > 0) return;
    const n = count;
    count = 0;
    notify(n);
  };

  // Đăng ký trước mọi listener của sendNow: lúc chạy, id vẫn còn trong `foreground`.
  const offSent = ob.onSent((note) => {
    if (!foreground.has(note.id)) count++;
  });
  const offChange = ob.subscribe(() => {
    timer ??= setTimeout(check, 0);
  });

  /** remove/clear: hàng hết note chờ không phải do gửi thì bỏ số đã đếm, không báo. */
  const dropIfEmpty = () => {
    if (pendingLeft() === 0) count = 0;
  };

  return {
    ...ob,
    sendNow: async (id, opts) => {
      foreground.set(id, (foreground.get(id) ?? 0) + 1);
      try {
        return await ob.sendNow(id, opts);
      } finally {
        const n = (foreground.get(id) ?? 1) - 1;
        if (n > 0) foreground.set(id, n);
        else foreground.delete(id);
      }
    },
    remove: async (id) => {
      await ob.remove(id);
      dropIfEmpty();
    },
    clear: async () => {
      await ob.clear();
      dropIfEmpty();
    },
    dispose: () => {
      if (timer) clearTimeout(timer);
      offSent();
      offChange();
      ob.dispose();
    },
  };
}
