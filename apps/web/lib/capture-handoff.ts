import { readDraft, writeDraft, type DraftStorage, type StoredDraft } from './local-draft';
import type { NoteDraft } from './note-draft';

/** "Mở rộng" từ sheet ghi nhanh sang trình soạn đầy đủ: một lần, cùng id note. */
export const CAPTURE_HANDOFF_KEY = 'nb:capture-handoff';

export function getSessionStorage(): DraftStorage | null {
  try {
    return typeof window === 'undefined' ? null : (window.sessionStorage ?? null);
  } catch {
    return null;
  }
}

export function writeHandoff(storage: DraftStorage | null, id: string, draft: NoteDraft): boolean {
  const value: StoredDraft = {
    noteId: id,
    draft,
    baseVersion: null,
    savedAt: new Date().toISOString(),
  };
  return writeDraft(storage, CAPTURE_HANDOFF_KEY, value);
}

/** Đọc (không xóa: StrictMode gọi initializer hai lần). Xóa bằng clearDraft sau khi mount. */
export const readHandoff = (storage: DraftStorage | null): StoredDraft | null =>
  readDraft(storage, CAPTURE_HANDOFF_KEY);
