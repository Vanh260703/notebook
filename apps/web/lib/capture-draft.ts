import type { DraftStorage } from './local-draft';

/**
 * Nháp của ô ghi nhanh (chữ đang gõ, chưa lưu). Sheet "Ghi nhanh" bị unmount khi đóng (chạm nhầm
 * lớp nền, Esc, ✕), nên chữ phải nằm ngoài component: mở lại sheet thì điền lại.
 * Chỉ xóa khi note đã vào outbox (hoặc đã POST xong), khi bấm "Mở rộng", hoặc khi đăng xuất.
 *
 * localStorage (không phải sessionStorage): iOS có thể kill PWA ở nền, sessionStorage mất theo.
 * Mọi truy cập storage đều bọc try/catch như `local-draft.ts`.
 */
export const CAPTURE_DRAFT_PREFIX = 'nb:capture-draft';
/** Sheet "Ghi nhanh" (tab bar, sidebar, phím C, bảng lệnh). */
export const SHEET_DRAFT_KEY = CAPTURE_DRAFT_PREFIX;
/** Ô ghi nhanh trong trang Hôm nay (desktop). */
export const INLINE_DRAFT_KEY = `${CAPTURE_DRAFT_PREFIX}:today`;

export function readCaptureDraft(storage: DraftStorage | null, key: string): string {
  if (!storage) return '';
  try {
    return storage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

/** Ghi nháp; chữ trống (chỉ khoảng trắng) thì xóa key. Trả false nếu storage lỗi. */
export function writeCaptureDraft(
  storage: DraftStorage | null,
  key: string,
  text: string,
): boolean {
  if (!storage) return false;
  try {
    if (text.trim() === '') storage.removeItem(key);
    else storage.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

/** Xóa mọi nháp ghi nhanh (khi đăng xuất). */
export function clearCaptureDrafts(
  storage: Pick<Storage, 'length' | 'key' | 'removeItem'> | null,
): void {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k === CAPTURE_DRAFT_PREFIX || k?.startsWith(`${CAPTURE_DRAFT_PREFIX}:`)) keys.push(k);
    }
    keys.forEach((k) => storage.removeItem(k));
  } catch {
    // storage bị chặn: không có gì để xóa
  }
}
