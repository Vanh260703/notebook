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
 * Hiện code block trong editor như Slack: không thấy dòng ```.
 * Code block đã đóng: hai dòng ``` ẩn hẳn, các dòng code thành một hộp có viền, chữ màu cam.
 * Dòng ẩn là "atomic" (con trỏ nhảy qua) và được bảo vệ: gõ/xóa không làm hỏng rào. Gõ ngay
 * trước/sau hộp thì chữ sang dòng mới ngoài hộp. Xóa lùi trong hộp rỗng thì bỏ cả hộp.
 * Decoration ẩn cả dấu xuống dòng nên phải cấp từ StateField (ViewPlugin không được phép).
 */

const hidden = Decoration.replace({});
const lineDeco = (first: boolean, last: boolean) =>
  Decoration.line({
    class: ['cm-code-line', first && 'cm-code-line-first', last && 'cm-code-line-last']
      .filter(Boolean)
      .join(' '),
  });

/** Một code block đã đóng đang được hiện dạng hộp. */
interface Box {
  from: number; // đầu dòng ``` mở
  to: number; // cuối dòng ``` đóng
  head: { from: number; to: number }; // vùng ẩn phía trên: dòng mở + '\n'
  tail: { from: number; to: number }; // vùng ẩn phía dưới: '\n' + dòng đóng
  empty: boolean; // chỉ có khoảng trắng bên trong
}

interface CodeStyle {
  decorations: DecorationSet;
  atomic: DecorationSet;
  boxes: Box[];
}

function build(state: EditorState): CodeStyle {
  const { doc } = state;
  const decos: Range<Decoration>[] = [];
  const atomic: Range<Decoration>[] = [];
  const boxes: Box[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
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
      for (let n = first; n <= last; n++) {
        // Dòng ``` mở bị ẩn cả '\n' nên dòng code đầu nối vào nó: dòng hiển thị bắt đầu ở openLine.from.
        const at = n === first ? openLine.from : doc.line(n).from;
        decos.push(lineDeco(n === first, n === last).range(at));
      }
      return false;
    },
  });
  return {
    decorations: Decoration.set(decos, true),
    atomic: Decoration.set(atomic, true),
    boxes,
  };
}

const codeStyleField = StateField.define<CodeStyle>({
  create: build,
  update(value, tr) {
    if (tr.docChanged || syntaxTree(tr.startState) !== syntaxTree(tr.state)) {
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

export const codeStyle = [codeStyleField, protectFences, fenceOnType];
