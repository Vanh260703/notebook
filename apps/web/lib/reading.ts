import { stripMarkdown } from './markdown';

/** Tốc độ đọc màn hình: tiếng Việt đếm theo tiếng (âm tiết), khoảng 230 tiếng/phút. */
export const WORDS_PER_MINUTE = 230;

export const wordCount = (markdown: string): number =>
  stripMarkdown(markdown).split(/\s+/).filter(Boolean).length;

/** Số phút đọc, tối thiểu 1. */
export const readingMinutes = (words: number): number =>
  Math.max(1, Math.round(words / WORDS_PER_MINUTE));

/** 1350 → "1.350" (dấu chấm phân cách hàng nghìn kiểu Việt Nam, không phụ thuộc ICU). */
export const formatCount = (n: number): string =>
  String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Id cho heading: bỏ dấu (NFD + bỏ dấu tổ hợp, đ → d), chữ thường, ký tự không phải chữ/số thành
 * "-", tối đa 64 ký tự. Rỗng (chỉ có emoji, dấu câu) thì là "muc".
 */
export function slugify(text: string): string {
  const s = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return s || 'muc';
}
