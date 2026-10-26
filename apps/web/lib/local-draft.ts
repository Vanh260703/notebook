import { NOTE_STATUSES, NOTE_TYPES } from '@notebook/shared';
import type { NoteDraft } from './note-draft';

/**
 * Nháp cục bộ của form note (lớp bảo vệ thứ hai, sau guard điều hướng).
 * Lo các trường hợp guard không chặn được: nút Back, iOS kill tab, crash, đóng tab trên iOS
 * (Safari không phát beforeunload).
 *
 * - Note đã có: key `nb:draft:<id>`.
 * - Note mới (chưa POST lần nào): một ô duy nhất `nb:draft:new`, vì mỗi lần mở /notes/new là một id mới.
 *
 * Mọi truy cập storage đều bọc try/catch: Safari chế độ riêng tư, storage bị chặn, hết quota...
 * thì chỉ mất lớp nháp, app vẫn chạy. Sau này (GĐ2) có thể thay `DraftStorage` bằng IndexedDB
 * mà không đổi chỗ gọi.
 */
export interface StoredDraft {
  /** id của note (với note mới: id đã sinh sẵn, dùng lại để POST idempotent). */
  noteId: string;
  draft: NoteDraft;
  /** version của bản trên server lúc bắt đầu sửa; null với note mới. */
  baseVersion: number | null;
  /** ISO timestamp lúc ghi nháp. */
  savedAt: string;
}

/** Tập con của `Storage` mà module này dùng (để test bằng bản giả). */
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const DRAFT_PREFIX = 'nb:draft:';
export const NEW_DRAFT_KEY = `${DRAFT_PREFIX}new`;
export const draftKey = (noteId: string): string => `${DRAFT_PREFIX}${noteId}`;

/** localStorage, hoặc null nếu không dùng được (SSR, bị chặn, truy cập ném lỗi). */
export function getDraftStorage(): DraftStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

const isString = (v: unknown): v is string => typeof v === 'string';

function parseDraft(v: unknown): NoteDraft | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  if (
    !isString(d.title) ||
    !isString(d.content) ||
    !isString(d.entryDate) ||
    typeof d.pinned !== 'boolean' ||
    !(NOTE_TYPES as readonly unknown[]).includes(d.type) ||
    !(NOTE_STATUSES as readonly unknown[]).includes(d.status) ||
    !Array.isArray(d.tags) ||
    !d.tags.every(isString)
  ) {
    return null;
  }
  return {
    title: d.title,
    content: d.content,
    type: d.type as NoteDraft['type'],
    status: d.status as NoteDraft['status'],
    entryDate: d.entryDate,
    pinned: d.pinned,
    tags: d.tags,
  };
}

/** Đọc nháp; dữ liệu hỏng/sai dạng (do phiên bản cũ, sửa tay...) coi như không có. */
export function readDraft(storage: DraftStorage | null, key: string): StoredDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Record<string, unknown>;
    const draft = parseDraft(v?.draft);
    if (
      !draft ||
      !isString(v.noteId) ||
      !isString(v.savedAt) ||
      !(v.baseVersion === null || typeof v.baseVersion === 'number')
    ) {
      return null;
    }
    return { noteId: v.noteId, draft, baseVersion: v.baseVersion, savedAt: v.savedAt };
  } catch {
    return null;
  }
}

/** Ghi nháp. Trả false nếu không ghi được (storage bị chặn, hết quota). */
export function writeDraft(storage: DraftStorage | null, key: string, value: StoredDraft): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storage: DraftStorage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Không xóa được thì thôi: lần sau mở note, banner nháp vẫn cho bấm "Bỏ".
  }
}

/** Nháp có nội dung gì không (với note mới: form trống thì không cần giữ). */
export const isDraftEmpty = (d: NoteDraft): boolean =>
  d.title.trim() === '' && d.content.trim() === '' && d.tags.length === 0;

/**
 * Debounce việc ghi nháp. `flush()` ghi ngay lần đang chờ (dùng khi tab bị ẩn / pagehide:
 * iOS có thể kill tab ở nền trước khi hết thời gian debounce).
 */
export function createDraftWriter(delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: (() => void) | null = null;
  const run = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const fn = pending;
    pending = null;
    fn?.();
  };
  return {
    schedule(fn: () => void) {
      pending = fn;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    },
    flush: run,
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
    get hasPending() {
      return pending !== null;
    },
  };
}
