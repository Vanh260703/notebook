import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorState,
  EditorView,
  type Range,
  StateField,
  Transaction,
  type TransactionSpec,
} from '@uiw/react-codemirror';

/*
 * Hiện code trong editor như Slack: không thấy ký hiệu Markdown, chữ code màu cam.
 * - Inline code (cùng dòng với chữ): ô có viền, dấu ` luôn ẩn. Cặp `` rỗng vừa chèn hiện thành ô
 *   rỗng khi con trỏ ở giữa. Xóa lùi vào dấu ` ẩn thì bỏ định dạng code (không để sót dấu ` lẻ).
 * - Code block đã đóng: hai dòng ``` ẩn hẳn, các dòng code thành một hộp có viền. Dòng ẩn là
 *   "atomic" (con trỏ nhảy qua) và được bảo vệ: gõ/xóa không làm hỏng rào. Gõ ngay trước/sau
 *   hộp thì chữ sang dòng mới ngoài hộp. Xóa lùi trong hộp rỗng thì bỏ cả hộp.
 * Decoration ẩn cả dấu xuống dòng nên phải cấp từ StateField (ViewPlugin không được phép).
 */

const hidden = Decoration.replace({});
const inlineChip = Decoration.mark({ class: 'cm-inline-code' });
const emptyChip = Decoration.mark({ class: 'cm-inline-code cm-inline-code-empty' });
/** Hộp rỗng/ngắn vẫn đủ rộng để thấy chỗ gõ. */
const MIN_BOX_CH = 12;
const TAB_CH = 4;

/** Độ rộng (theo ký tự) của dòng dài nhất; editor dùng font monospace nên `ch` khớp với chữ. */
function widestLine(lines: string[]): number {
  let max = 0;
  for (const text of lines) {
    let w = 0;
    for (const ch of text) w += ch === '\t' ? TAB_CH : 1;
    max = Math.max(max, w);
  }
  return Math.max(max, MIN_BOX_CH);
}

/**
 * Mỗi dòng code là một phần tử riêng nên tất cả cùng nhận một bề rộng (theo dòng dài nhất) để
 * hộp co vừa chữ mà vẫn thẳng mép. Dòng dài hơn khung soạn thì bị chặn ở 100% và xuống dòng.
 */
const lineDeco = (first: boolean, last: boolean, widthCh: number) =>
  Decoration.line({
    class: ['cm-code-line', first && 'cm-code-line-first', last && 'cm-code-line-last']
      .filter(Boolean)
      .join(' '),
    attributes: { style: `--code-box-ch: ${widthCh}` },
  });

/** Một code block đã đóng đang được hiện dạng hộp. */
interface Box {
  from: number; // đầu dòng ``` mở
  to: number; // cuối dòng ``` đóng
  head: { from: number; to: number }; // vùng ẩn phía trên: dòng mở + '\n'
  tail: { from: number; to: number }; // vùng ẩn phía dưới: '\n' + dòng đóng
  empty: boolean; // chỉ có khoảng trắng bên trong
}

/** Một inline code: vị trí hai chuỗi ` (đang ẩn). */
interface Span {
  from: number;
  to: number;
  open: { from: number; to: number };
  close: { from: number; to: number };
}

interface CodeStyle {
  decorations: DecorationSet;
  atomic: DecorationSet;
  boxes: Box[];
  spans: Span[];
}

/** Con trỏ đứng giữa một cặp `` rỗng (chưa thành inline code vì chưa có chữ): trả về đầu cặp. */
function emptyPairAt(state: EditorState): number | null {
  const sel = state.selection.main;
  if (!sel.empty) return null;
  const at = sel.head - 1;
  const ch = (p: number) => (p < 0 ? '' : state.doc.sliceString(p, p + 1));
  return ch(at) === '`' && ch(at + 1) === '`' && ch(at - 1) !== '`' && ch(at + 2) !== '`'
    ? at
    : null;
}

function build(state: EditorState): CodeStyle {
  const { doc } = state;
  const decos: Range<Decoration>[] = [];
  const atomic: Range<Decoration>[] = [];
  const boxes: Box[] = [];
  const spans: Span[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'InlineCode') {
        const marks: { from: number; to: number }[] = [];
        const cur = node.node.cursor();
        if (cur.firstChild()) {
          do if (cur.name === 'CodeMark') marks.push({ from: cur.from, to: cur.to });
          while (cur.nextSibling());
        }
        const [open, close] = [marks[0], marks[marks.length - 1]];
        if (!open || !close || open === close || open.to >= close.from) return false;
        spans.push({ from: node.from, to: node.to, open, close });
        decos.push(
          hidden.range(open.from, open.to),
          inlineChip.range(open.to, close.from),
          hidden.range(close.from, close.to),
        );
        return false;
      }
      if (node.name !== 'FencedCode') return;
      // Rào đóng là CodeMark cuối (CodeMark đầu là rào mở).
      let close: { from: number } | undefined;
      let marks = 0;
      const cur = node.node.cursor();
      if (cur.firstChild()) {
        do if (cur.name === 'CodeMark' && ++marks > 1) close = { from: cur.from };
        while (cur.nextSibling());
      }
      const openLine = doc.lineAt(node.from);
      const closeLine = close ? doc.lineAt(close.from) : null;
      // Chưa đóng (đang gõ dở) hoặc không có dòng nội dung: để nguyên dạng Markdown.
      if (!closeLine || closeLine.number < openLine.number + 2) return false;
      const first = openLine.number + 1;
      const last = closeLine.number - 1;
      const lastLine = doc.line(last);
      const box: Box = {
        from: openLine.from,
        to: closeLine.to,
        head: { from: openLine.from, to: openLine.to + 1 },
        tail: { from: lastLine.to, to: closeLine.to },
        empty: doc.sliceString(openLine.to + 1, lastLine.to).trim() === '',
      };
      boxes.push(box);
      for (const r of [box.head, box.tail]) {
        decos.push(hidden.range(r.from, r.to));
        atomic.push(hidden.range(r.from, r.to));
      }
      const lineTexts: string[] = [];
      for (let n = first; n <= last; n++) lineTexts.push(doc.line(n).text);
      const widthCh = widestLine(lineTexts);
      for (let n = first; n <= last; n++) {
        // Dòng ``` mở bị ẩn cả '\n' nên dòng code đầu nối vào nó: dòng hiển thị bắt đầu ở openLine.from.
        const at = n === first ? openLine.from : doc.line(n).from;
        decos.push(lineDeco(n === first, n === last, widthCh).range(at));
      }
      return false;
    },
  });
  const pair = emptyPairAt(state);
  if (pair !== null) decos.push(emptyChip.range(pair, pair + 2));
  return {
    decorations: Decoration.set(decos, true),
    atomic: Decoration.set(atomic, true),
    boxes,
    spans,
  };
}

const codeStyleField = StateField.define<CodeStyle>({
  create: build,
  update(value, tr) {
    if (tr.docChanged || tr.selection || syntaxTree(tr.startState) !== syntaxTree(tr.state)) {
      return build(tr.state);
    }
    return value;
  },
  provide: (f) => [
    EditorView.decorations.from(f, (v) => v.decorations),
    EditorView.atomicRanges.of((view) => view.state.field(f).atomic),
  ],
});

/** Sửa do người dùng gõ/xóa/kéo thả (lệnh của app dùng 'input.code', undo/redo và setValue không bị chặn). */
function isUserEdit(tr: Transaction) {
  return (
    (tr.isUserEvent('input') && !tr.isUserEvent('input.code')) ||
    tr.isUserEvent('delete') ||
    tr.isUserEvent('move')
  );
}

const overlaps = (a: number, b: number, r: { from: number; to: number }) => a < r.to && b > r.from;

const protectFences = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || !isUserEdit(tr)) return tr;
  const { boxes } = tr.startState.field(codeStyleField);
  if (!boxes.length) return tr;

  const changes: { from: number; to: number; insert: string }[] = [];
  tr.changes.iterChanges((from, to, _f, _t, inserted) =>
    changes.push({ from, to, insert: inserted.toString() }),
  );
  let rewrite: TransactionSpec | null = null;
  for (const c of changes) {
    for (const box of boxes) {
      const hit =
        c.from === c.to
          ? (c.from > box.head.from && c.from < box.head.to) ||
            (c.from > box.tail.from && c.from < box.tail.to) ||
            c.from === box.head.from ||
            c.from === box.tail.to
          : overlaps(c.from, c.to, box.head) || overlaps(c.from, c.to, box.tail);
      if (!hit) continue;
      // Xóa/thay cả khối (chọn hết rồi xóa, dán đè...) thì cho qua.
      if (c.from <= box.from && c.to >= box.to) continue;
      if (changes.length > 1) return {}; // nhiều con trỏ chạm rào: bỏ qua cho an toàn
      // Gõ ngay trước hộp (con trỏ ở đầu vùng ẩn trên): chữ thành dòng mới phía trên hộp.
      if (c.from === c.to && c.from === box.head.from) {
        const insert = c.insert.endsWith('\n') ? c.insert : `${c.insert}\n`;
        rewrite = {
          changes: { from: c.from, insert },
          selection: { anchor: c.from + c.insert.length },
        };
        continue;
      }
      // Gõ ngay sau hộp (con trỏ ở cuối vùng ẩn dưới): chữ thành dòng mới phía dưới hộp.
      if (c.from === c.to && c.from === box.tail.to) {
        const insert = c.insert.startsWith('\n') ? c.insert : `\n${c.insert}`;
        rewrite = {
          changes: { from: c.from, insert },
          selection: { anchor: c.from + insert.length },
        };
        continue;
      }
      // Xóa chạm rào của hộp rỗng (Backspace/Delete trong hộp rỗng): bỏ cả hộp, như Slack.
      if (box.empty && c.insert === '') {
        const end = box.to < tr.startState.doc.length ? box.to + 1 : box.to;
        rewrite = { changes: { from: box.from, to: end }, selection: { anchor: box.from } };
        continue;
      }
      return {}; // còn lại (xóa lùi ở đầu hộp, gõ đè lên rào...): không làm gì
    }
  }
  if (!rewrite) return tr;
  return { ...rewrite, scrollIntoView: true, userEvent: tr.annotation(Transaction.userEvent) };
});

/**
 * Xóa (Backspace/Delete) chạm vào dấu ` đang ẩn của một inline code: bỏ cả hai đầu, giữ chữ, thay
 * vì để lại một dấu ` lẻ. Cặp `` rỗng thì xóa cả cặp.
 */
const protectInlineCode = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || !tr.isUserEvent('delete')) return tr;
  const changes: { from: number; to: number; inserted: number }[] = [];
  tr.changes.iterChanges((from, to, _f, _t, inserted) =>
    changes.push({ from, to, inserted: inserted.length }),
  );
  const c = changes[0];
  if (changes.length !== 1 || !c || c.inserted) return tr;
  const state = tr.startState;
  for (const s of state.field(codeStyleField).spans) {
    if (!overlaps(c.from, c.to, s.open) && !overlaps(c.from, c.to, s.close)) continue;
    if (c.from <= s.from && c.to >= s.to) return tr;
    const unwrap = state.changes([
      { from: s.open.from, to: s.open.to },
      { from: s.close.from, to: s.close.to },
    ]);
    return {
      changes: unwrap,
      selection: { anchor: unwrap.mapPos(c.from, -1) },
      userEvent: tr.annotation(Transaction.userEvent),
    };
  }
  const pair = emptyPairAt(state);
  if (pair !== null && c.from >= pair && c.to <= pair + 2) {
    return {
      changes: { from: pair, to: pair + 2 },
      selection: { anchor: pair },
      userEvent: tr.annotation(Transaction.userEvent),
    };
  }
  return tr;
});

/** Gõ dấu ` thứ ba trên dòng trống (```) thì tạo ngay một code block rỗng, như Slack. */
const fenceOnType = EditorView.inputHandler.of((view, from, to, text) => {
  if (text !== '`' || from !== to) return false;
  const { state } = view;
  const line = state.doc.lineAt(from);
  if (line.text !== '``' || from !== line.to) return false;
  // Đang ở trong một code block chưa đóng (gõ rào đóng bằng tay) thì để yên.
  for (let n = syntaxTree(state).resolveInner(from, -1); n; n = n.parent!) {
    if (n.name === 'FencedCode') return false;
    if (!n.parent) break;
  }
  const after = line.to < state.doc.length ? '' : '\n';
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: `\`\`\`\n\n\`\`\`${after}` },
    selection: { anchor: line.from + 4 },
    userEvent: 'input.code',
    scrollIntoView: true,
  });
  return true;
});

export const codeStyle = [codeStyleField, protectFences, protectInlineCode, fenceOnType];
