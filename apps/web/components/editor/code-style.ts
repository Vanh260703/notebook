import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  type EditorState,
  type Range,
  ViewPlugin,
  type ViewUpdate,
  type EditorView,
} from '@uiw/react-codemirror';

const inlineCode = Decoration.mark({ class: 'cm-inline-code' });
const codeMark = Decoration.mark({ class: 'cm-code-mark' });
const hidden = Decoration.replace({});
const codeLine = Decoration.line({ class: 'cm-code-line' });
const codeLineFirst = Decoration.line({ class: 'cm-code-line cm-code-line-first' });
const codeLineLast = Decoration.line({ class: 'cm-code-line cm-code-line-last' });
const codeLineOnly = Decoration.line({
  class: 'cm-code-line cm-code-line-first cm-code-line-last',
});

/** Con trỏ/vùng chọn chạm vào [from, to] (kể cả đứng ngay sát hai đầu). */
function touches(state: EditorState, from: number, to: number) {
  return state.selection.ranges.some((r) => r.from <= to && r.to >= from);
}

function build(view: EditorView): DecorationSet {
  const { state } = view;
  const decos: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === 'FencedCode') {
          const first = state.doc.lineAt(node.from).number;
          const last = state.doc.lineAt(node.to).number;
          for (let n = first; n <= last; n++) {
            const deco =
              first === last
                ? codeLineOnly
                : n === first
                  ? codeLineFirst
                  : n === last
                    ? codeLineLast
                    : codeLine;
            decos.push(deco.range(state.doc.line(n).from));
          }
          return false;
        }
        if (node.name !== 'InlineCode') return;
        // Hai đầu là CodeMark (chuỗi `); nội dung ở giữa thành "chip" như Slack.
        const marks: { from: number; to: number }[] = [];
        const cur = node.node.cursor();
        if (cur.firstChild()) {
          do if (cur.name === 'CodeMark') marks.push({ from: cur.from, to: cur.to });
          while (cur.nextSibling());
        }
        const [open, close] = [marks[0], marks[marks.length - 1]];
        if (!open || !close || open === close || open.to >= close.from) return false;
        decos.push(inlineCode.range(open.to, close.from));
        // Con trỏ ở ngoài thì ẩn dấu `; đi vào (hoặc đứng sát) thì hiện mờ để sửa được.
        const mark = touches(state, node.from, node.to) ? codeMark : hidden;
        decos.push(mark.range(open.from, open.to), mark.range(close.from, close.to));
        return false;
      },
    });
  }
  return Decoration.set(decos, true);
}

/** Hiện code trong editor gần giống bản xem trước: inline code dạng chip màu cam, code block có nền. */
export const codeStyle = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      if (
        u.docChanged ||
        u.selectionSet ||
        u.viewportChanged ||
        syntaxTree(u.startState) !== syntaxTree(u.state)
      )
        this.decorations = build(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);
