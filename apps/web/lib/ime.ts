/**
 * Phím đang thuộc một lần gõ IME (bộ gõ tiếng Việt trên macOS, Gboard, Telex/VNI của trình duyệt):
 * Enter/Esc lúc này là để chốt chữ, KHÔNG phải để lưu/đóng. Safari phát keydown của lần chốt với
 * isComposing = false nhưng keyCode 229, nên kiểm cả hai.
 */
export function isImeComposing(e: { isComposing?: boolean; keyCode?: number }): boolean {
  return Boolean(e.isComposing) || e.keyCode === 229;
}

export type LineBreakAction = 'ignore' | 'allow' | 'save' | 'save-after-composition';

/**
 * Ô ghi nhanh trên màn cảm ứng, ở `beforeinput`: Enter mà keydown đã bỏ qua (Gboard đang gạch chân
 * một từ phát keyCode 229) vẫn chèn ngắt dòng. Thiết kế: muốn nhiều dòng thì "Mở rộng", nên chặn
 * ngắt dòng và lưu.
 * - `ignore`: không phải ngắt dòng (gõ chữ, dán nhiều dòng vẫn giữ nguyên).
 * - `allow`: Shift+Enter từ bàn phím ngoài (iPad) vẫn xuống dòng.
 * - `save-after-composition`: còn đang trong lần gõ IME: chặn, lưu khi chữ đã chốt (compositionend).
 * - `save`: chặn và lưu ngay.
 */
export function lineBreakAction(
  e: { inputType: string; isComposing?: boolean },
  shiftEnter: boolean,
): LineBreakAction {
  if (e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph') return 'ignore';
  if (shiftEnter) return 'allow';
  return e.isComposing ? 'save-after-composition' : 'save';
}
