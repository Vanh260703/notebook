import { NOTE_TAGS_MAX, tagNameSchema } from '@notebook/shared';

export interface CommitTagsResult {
  tags: string[];
  /** Thông báo lỗi nếu có phần không hợp lệ hoặc vượt giới hạn; null nếu ổn. */
  error: string | null;
}

/**
 * Thêm các tag trong `raw` (tách bằng dấu phẩy) vào `current`.
 * Tên được chuẩn hóa giống API (tagNameSchema: trim, NFC, chữ thường), bỏ trùng.
 * Gặp tên không hợp lệ thì dừng, giữ nguyên `current` cho phần đó và báo lỗi.
 */
export function commitTagText(current: string[], raw: string): CommitTagsResult {
  const next = [...current];
  for (const part of raw.split(',')) {
    if (!part.trim()) continue;
    const parsed = tagNameSchema.safeParse(part);
    if (!parsed.success) return { tags: current, error: 'Tên tag tối đa 64 ký tự' };
    if (next.includes(parsed.data)) continue;
    if (next.length >= NOTE_TAGS_MAX) return { tags: next, error: `Tối đa ${NOTE_TAGS_MAX} tag` };
    next.push(parsed.data);
  }
  return { tags: next, error: null };
}

/**
 * Có nên thêm tag ngay khi ô nhập đổi không (không chờ Enter):
 * - Chuỗi có dấu phẩy: bàn phím ảo (Gboard gửi `key: "Unidentified"`) không bắt được qua keydown.
 * - Chọn gợi ý từ <datalist>: Chrome phát `input` không phải InputEvent (inputType undefined),
 *   Firefox/Safari dùng `insertReplacementText`. Chỉ nhận khi giá trị khớp đúng một gợi ý, để
 *   autocorrect (cũng là insertReplacementText) không tự thêm tag dở dang.
 */
export function shouldCommitOnInput(
  value: string,
  inputType: string | undefined,
  suggestions: readonly string[],
): boolean {
  if (value.includes(',')) return true;
  if (inputType !== undefined && inputType !== 'insertReplacementText') return false;
  const parsed = tagNameSchema.safeParse(value);
  return parsed.success && suggestions.includes(parsed.data);
}
