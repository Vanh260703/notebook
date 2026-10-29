import type { EditorView } from '@uiw/react-codemirror';

/** Một lần thay chữ trong editor: thay [from, to) bằng `insert`, rồi đặt vùng chọn [selFrom, selTo] (vị trí sau khi thay). */
export interface TextEdit {
  from: number;
  to: number;
  insert: string;
  selFrom: number;
  selTo: number;
}

interface Line {
  from: number;
  to: number; // không gồm '\n'
  text: string;
}

const OPEN_FENCE = /^ {0,3}(`{3,}|~{3,})/;
const CLOSE_FENCE = /^ {0,3}(`{3,}|~{3,})\s*$/;

function splitLines(doc: string): Line[] {
  const lines: Line[] = [];
  let from = 0;
  for (const text of doc.split('\n')) {
    lines.push({ from, to: from + text.length, text });
    from += text.length + 1;
  }
  return lines;
}

function lineIndexAt(lines: Line[], pos: number): number {
  let i = 0;
  while (i < lines.length - 1 && lines[i + 1]!.from <= pos) i++;
  return i;
}

/** Các code fence trong doc: [dòng mở, dòng đóng]. Fence chưa đóng thì `close` là null (kéo tới cuối doc, như CommonMark). */
function findFences(lines: Line[]): { open: number; close: number | null }[] {
  const blocks: { open: number; close: number | null }[] = [];
  let open: { line: number; marker: string } | null = null;
  for (const [i, line] of lines.entries()) {
    if (!open) {
      const m = OPEN_FENCE.exec(line.text);
      if (m) open = { line: i, marker: m[1]! };
      continue;
    }
    const m = CLOSE_FENCE.exec(line.text);
    if (m && m[1]![0] === open.marker[0] && m[1]!.length >= open.marker.length) {
      blocks.push({ open: open.line, close: i });
      open = null;
    }
  }
  if (open) blocks.push({ open: open.line, close: null });
  return blocks;
}

/**
 * Bật/tắt code block cho các dòng đang chọn (Ctrl/Cmd+Shift+C, giống Slack):
 * - Vùng chọn nằm trọn trong một code fence: bỏ hai dòng rào, giữ nội dung.
 * - Ngược lại: bọc các dòng đó bằng ``` (dài hơn mọi rào sẵn có bên trong). Dòng trống thì mở
 *   một block rỗng và đặt con trỏ vào giữa.
 * Con trỏ/vùng chọn giữ nguyên trên cùng đoạn chữ, không chọn cả block (gõ tiếp sẽ không ghi đè).
 */
export function toggleCodeBlock(doc: string, from: number, to: number): TextEdit {
  const lines = splitLines(doc);
  const startLine = lineIndexAt(lines, from);
  let endLine = lineIndexAt(lines, to);
  // Chọn tới đầu dòng sau (kéo chuột cả dòng) thì không tính dòng sau.
  if (to > from && endLine > startLine && lines[endLine]!.from === to) endLine--;

  const block = findFences(lines).find(
    (b) => b.open <= startLine && endLine <= (b.close ?? lines.length - 1),
  );
  if (block) {
    const open = lines[block.open]!;
    const close = block.close === null ? null : lines[block.close]!;
    const innerFrom = open.to + 1;
    const innerTo = close ? close.from - 1 : lines[lines.length - 1]!.to;
    const inner = innerFrom <= innerTo ? doc.slice(innerFrom, innerTo) : '';
    const rangeTo = close ? close.to : innerTo;
    const map = (p: number) =>
      Math.min(Math.max(p, innerFrom), Math.max(innerFrom, innerTo)) - innerFrom + open.from;
    return { from: open.from, to: rangeTo, insert: inner, selFrom: map(from), selTo: map(to) };
  }

  const rangeFrom = lines[startLine]!.from;
  const rangeTo = lines[endLine]!.to;
  const inner = doc.slice(rangeFrom, rangeTo);
  const longest = Math.max(0, ...[...inner.matchAll(/^ {0,3}(`{3,})/gm)].map((m) => m[1]!.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  if (from === to && inner.trim() === '') {
    const cursor = rangeFrom + fence.length + 1;
    return {
      from: rangeFrom,
      to: rangeTo,
      insert: `${fence}\n\n${fence}`,
      selFrom: cursor,
      selTo: cursor,
    };
  }
  const shift = fence.length + 1;
  return {
    from: rangeFrom,
    to: rangeTo,
    insert: `${fence}\n${inner}\n${fence}`,
    selFrom: from + shift,
    selTo: to + shift,
  };
}

/** Lệnh CodeMirror (dùng cho keymap và nút trên thanh công cụ). Chỉ import type nên không kéo CodeMirror vào bundle. */
export function toggleCodeBlockCommand(view: EditorView): boolean {
  const { from, to } = view.state.selection.main;
  const edit = toggleCodeBlock(view.state.doc.toString(), from, to);
  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: edit.selFrom, head: edit.selTo },
    scrollIntoView: true,
    userEvent: 'input',
  });
  return true;
}
