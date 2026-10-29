import type { CreateNoteInput } from '@notebook/shared';

export type OutboxSource = 'capture' | 'editor';

/** Một note mới chưa lên server, nằm trong IndexedDB. Khóa là id của note (UUID tạo ở client). */
export interface OutboxRecord {
  id: string;
  /** Payload POST /notes, đã qua createNoteSchema.parse trước khi vào hàng. */
  input: CreateNoteInput;
  /** ISO, lúc ghi vào hàng (thứ tự gửi: cũ trước). */
  queuedAt: string;
  /** +1 mỗi lần editor lưu lại khi note chưa lên server. */
  rev: number;
  attempts: number;
  /** epoch ms, 0 = gửi ngay. */
  nextAttemptAt: number;
  /** failed: lỗi vĩnh viễn (400, 409 VERSION_CONFLICT...), cần người dùng xử lý. */
  state: 'pending' | 'failed';
  lastError: { status: number; code: string; message: string } | null;
  /** POST đã thành công nhưng rev đổi trong lúc gửi: còn một PATCH với version này. */
  created?: { version: number };
  source: OutboxSource;
}

/** Storage tách khỏi logic hàng đợi: IndexedDB khi chạy, bản trong RAM khi test. */
export interface OutboxStore {
  getAll(): Promise<OutboxRecord[]>;
  put(r: OutboxRecord): Promise<void>;
  delete(id: string): Promise<void>;
  /** Nguyên tử: chỉ xóa khi rev còn đúng `rev`. Trả true nếu đã xóa. */
  deleteIfRev(id: string, rev: number): Promise<boolean>;
  /** Nguyên tử: đọc → fn → ghi. Trả false nếu không có record. */
  update(id: string, fn: (r: OutboxRecord) => OutboxRecord): Promise<boolean>;
  clear(): Promise<void>;
}
