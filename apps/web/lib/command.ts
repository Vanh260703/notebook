/**
 * Logic thuần của bảng lệnh Ctrl/Cmd+K (không phụ thuộc React, có test).
 */

/** Bỏ dấu tiếng Việt và chữ thường để so khớp lệnh ("hom nay" khớp "Hôm nay", "thung rac" khớp "Thùng rác"). */
export function foldVi(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** Mọi từ của query (đã bỏ dấu) là đầu của một từ trong nhãn hoặc từ khóa của lệnh. */
export function matchCommand(texts: readonly string[], query: string): boolean {
  const words = foldVi(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = texts.flatMap((t) => foldVi(t).split(/[^\p{L}\p{N}]+/u)).filter(Boolean);
  return words.every((w) => hay.some((h) => h.startsWith(w)));
}

/** Mục đang chọn sau khi bấm ↑/↓ (vòng quanh). `count` 0 thì -1. */
export function moveActive(index: number, delta: number, count: number): number {
  if (count <= 0) return -1;
  if (index < 0) return delta > 0 ? 0 : count - 1;
  return (((index + delta) % count) + count) % count;
}

/** Nhãn phím tắt theo hệ điều hành: "⌘K" trên Mac/iOS, "Ctrl K" ở máy khác. */
export const shortcutLabel = (key: string, mac: boolean): string =>
  mac ? `⌘${key}` : `Ctrl ${key}`;

export const isMacPlatform = (platform: string): boolean => /Mac|iPhone|iPad|iPod/.test(platform);

/**
 * Phần tử đang focus là chỗ gõ chữ (phím tắt một ký tự như "C" không được chạy ở đây).
 * Nhận object tối thiểu để test được không cần DOM.
 */
export function isTypingTarget(
  el: { tagName?: string; isContentEditable?: boolean; type?: string } | null,
): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(
    (el.type ?? 'text').toLowerCase(),
  );
}
