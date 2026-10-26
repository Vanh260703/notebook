/** Bỏ ký hiệu Markdown để hiện excerpt dạng chữ thường trong danh sách. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[^\n]*\n?/g, ' ') // rào code fence (giữ nội dung code)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // ảnh
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // link
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // heading
    .replace(/^\s{0,3}>\s?/gm, '') // blockquote
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, '') // list, checklist
    .replace(/^\s*(?:[-*_]\s*){3,}$/gm, ' ') // đường kẻ ngang
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
