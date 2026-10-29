/**
 * Tìm kiếm full-text (Postgres). Chuỗi người dùng gõ được tách thành từ ở đây (JS), mỗi từ thành
 * prefix `'từ':*` nối bằng `&`. Bỏ dấu làm ở DB (f_unaccent ở cả cột search lẫn query).
 */
export const SEARCH_TERMS_MAX = 8;
export const SEARCH_TERM_MAX_LENGTH = 64;
/** Web gửi khi có q (ts_headline tốn hơn excerpt). */
export const SEARCH_LIMIT_DEFAULT = 20;
/** Marker bao chỗ khớp trong `highlight` (ký tự Private Use: không phải HTML, client không render thô). */
export const HIGHLIGHT_START = '\uE000';
export const HIGHLIGHT_END = '\uE001';

/**
 * Tách chuỗi tìm thành các từ (chữ thường, NFC). Chỉ giữ chữ (kể cả dấu tổ hợp) và số; mọi ký tự
 * khác là dấu cách, nên `docker-compose.yml` thành `docker`, `compose`, `yml`. Bỏ trùng, tối đa
 * SEARCH_TERMS_MAX từ, mỗi từ tối đa SEARCH_TERM_MAX_LENGTH code point.
 */
export function searchTerms(q: string): string[] {
  const words = q
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean);
  return [...new Set(words)]
    .slice(0, SEARCH_TERMS_MAX)
    .map((w) => Array.from(w).slice(0, SEARCH_TERM_MAX_LENGTH).join(''));
}

/**
 * `"'dock':* & 'vol':*"`; có `weight` thì chỉ khớp lexeme có trọng số đó (`'dock':*A`: tiêu đề). An toàn vì mỗi từ (từ searchTerms) chỉ có chữ/số: không có
 * ' \ : & | ! ( ) * <, nên chuỗi tsquery luôn hợp lệ. Giá trị vẫn gửi bằng tham số $n.
 */
export const prefixTsquery = (terms: readonly string[], weight?: 'A' | 'B' | 'D'): string =>
  terms.map((t) => `'${t}':*${weight ?? ''}`).join(' & ');

export interface HighlightPart {
  text: string;
  hit: boolean;
}

/**
 * Tách chuỗi có marker thành các đoạn để client bọc <mark> bằng React (không bao giờ dùng HTML).
 * Chịu được marker lẻ (ví dụ đoạn bị cắt mất một nửa): START không có END thì phần sau là khớp
 * tới hết chuỗi; END đứng một mình thì bỏ qua. Đoạn rỗng bị bỏ, đoạn liền nhau cùng loại được gộp.
 */
export function splitHighlight(s: string): HighlightPart[] {
  const parts: HighlightPart[] = [];
  let hit = false;
  let buf = '';
  const push = () => {
    if (!buf) return;
    const last = parts[parts.length - 1];
    if (last && last.hit === hit) last.text += buf;
    else parts.push({ text: buf, hit });
    buf = '';
  };
  for (const ch of s) {
    if (ch === HIGHLIGHT_START) {
      push();
      hit = true;
    } else if (ch === HIGHLIGHT_END) {
      push();
      hit = false;
    } else {
      buf += ch;
    }
  }
  push();
  return parts;
}

/** Có ít nhất một chỗ khớp (marker START) trong chuỗi. */
export const hasHighlight = (s: string): boolean => s.includes(HIGHLIGHT_START);

/** Bỏ marker, còn lại chữ thường. */
export const stripHighlight = (s: string): string =>
  s.replaceAll(HIGHLIGHT_START, '').replaceAll(HIGHLIGHT_END, '');
