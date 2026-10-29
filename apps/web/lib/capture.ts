import { NOTE_TAGS_MAX, NOTE_TITLE_MAX, tagNameSchema } from '@notebook/shared';

export interface ParsedCapture {
  title: string;
  content: string;
  tags: string[];
}

/**
 * Tách nội dung ô ghi nhanh: dòng đầu thành tiêu đề (nếu không dài quá NOTE_TITLE_MAX, khi đó cả
 * khối là nội dung), phần còn lại là nội dung. `#tag` bắt đầu bằng chữ thành tag ("#1" là số
 * issue, "# Heading" là Markdown: không thành tag). Chữ trong note giữ nguyên.
 */
export function parseCapture(text: string): ParsedCapture {
  const t = text.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  const [first = '', ...rest] = t.split('\n');
  const head = first.trim();
  const title = head.length <= NOTE_TITLE_MAX ? head : '';
  const content = title ? rest.join('\n').trim() : t;
  const tags: string[] = [];
  for (const m of t.matchAll(/(?:^|\s)#(\p{L}[\p{L}\p{M}\p{N}_-]*)/gu)) {
    const parsed = tagNameSchema.safeParse(m[1]);
    if (parsed.success && !tags.includes(parsed.data)) tags.push(parsed.data);
  }
  return { title, content, tags: tags.slice(0, NOTE_TAGS_MAX) };
}
