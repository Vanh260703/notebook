/**
 * Phím đang thuộc một lần gõ IME (bộ gõ tiếng Việt trên macOS, Gboard, Telex/VNI của trình duyệt):
 * Enter/Esc lúc này là để chốt chữ, KHÔNG phải để lưu/đóng. Safari phát keydown của lần chốt với
 * isComposing = false nhưng keyCode 229, nên kiểm cả hai.
 */
export function isImeComposing(e: { isComposing?: boolean; keyCode?: number }): boolean {
  return Boolean(e.isComposing) || e.keyCode === 229;
}
