import { describe, expect, it } from 'vitest';
import { toggleCode, toggleCodeBlock, toggleInlineCode, type TextEdit } from './code-block';

/** Áp dụng edit, trả về doc mới với vùng chọn đánh dấu bằng [ ] (hoặc | nếu rỗng). */
function apply(doc: string, edit: TextEdit): string {
  const out = doc.slice(0, edit.from) + edit.insert + doc.slice(edit.to);
  if (edit.selFrom === edit.selTo)
    return out.slice(0, edit.selFrom) + '|' + out.slice(edit.selFrom);
  return (
    out.slice(0, edit.selFrom) +
    '[' +
    out.slice(edit.selFrom, edit.selTo) +
    ']' +
    out.slice(edit.selTo)
  );
}

type Toggle = (doc: string, from: number, to: number) => TextEdit;

/** Doc viết kèm vùng chọn: `|` là con trỏ, `[...]` là vùng chọn. */
function run(marked: string, fn: Toggle = toggleCodeBlock): string {
  const caret = marked.indexOf('|');
  if (caret >= 0) {
    const doc = marked.replace('|', '');
    return apply(doc, fn(doc, caret, caret));
  }
  const from = marked.indexOf('[');
  const to = marked.indexOf(']') - 1;
  const doc = marked.replace('[', '').replace(']', '');
  return apply(doc, fn(doc, from, to));
}

describe('toggleCodeBlock', () => {
  it('opens an empty block on an empty line, caret inside', () => {
    expect(run('Lệnh:\n|')).toBe('Lệnh:\n```\n|\n```\n');
  });

  it('wraps the current line and keeps the caret on the same text', () => {
    expect(run('a\ndocker p|s\nb')).toBe('a\n```\ndocker p|s\n```\nb');
  });

  it('wraps every line the selection touches, keeping the selection', () => {
    expect(run('x\ndoc[ker ps\ndocker lo]gs\ny')).toBe('x\n```\ndoc[ker ps\ndocker lo]gs\n```\ny');
  });

  it('adds a line after the block when it ends the document', () => {
    expect(run('a\nx|')).toBe('a\n```\nx|\n```\n');
  });

  it('ignores the next line when the selection ends at its start', () => {
    expect(run('[a\nb\n]c')).toBe('```\n[a\nb\n]```\nc');
  });

  it('removes the fences when the caret is inside a block', () => {
    expect(run('a\n```bash\ndocker p|s\n```\nb')).toBe('a\ndocker p|s\nb');
  });

  it('removes the fences when the caret is on a fence line', () => {
    expect(run('```|\nx\n```')).toBe('|x');
  });

  it('round-trips: wrap then unwrap gives back the original', () => {
    const doc = 'a\ndocker ps\nb';
    const wrapped = toggleCodeBlock(doc, 4, 4);
    const doc2 = doc.slice(0, wrapped.from) + wrapped.insert + doc.slice(wrapped.to);
    const back = toggleCodeBlock(doc2, wrapped.selFrom, wrapped.selTo);
    expect(doc2.slice(0, back.from) + back.insert + doc2.slice(back.to)).toBe(doc);
    expect(back.selFrom).toBe(4);
  });

  it('removes an unclosed block that runs to the end', () => {
    expect(run('a\n```\nx|')).toBe('a\nx|');
  });

  it('uses a longer fence when the lines already contain one', () => {
    expect(run('[```js\nx\n```\ny]')).toBe('````\n[```js\nx\n```\ny]\n````\n');
  });

  it('does not treat ~~~ as closing a ``` block', () => {
    expect(run('```\n~~~\nx|\n```')).toBe('~~~\nx|');
  });
});

describe('toggleInlineCode', () => {
  const inline = (m: string) => run(m, toggleInlineCode);

  it('wraps the selection', () => {
    expect(inline('chạy [docker ps] nhé')).toBe('chạy `[docker ps]` nhé');
  });

  it('inserts an empty pair with the caret inside', () => {
    expect(inline('chạy |')).toBe('chạy `|`');
  });

  it('removes an empty pair when pressed again', () => {
    expect(inline('chạy `|`')).toBe('chạy |');
  });

  it('jumps out of the code when the caret is at its end, like Slack', () => {
    expect(inline('a `docker ps|` b')).toBe('a `docker ps`| b');
  });

  it('unwraps when the caret is in the middle', () => {
    expect(inline('a `dock|er` b')).toBe('a dock|er b');
  });

  it('unwraps when the selection is inside', () => {
    expect(inline('a `[docker] ps` b')).toBe('a [docker] ps b');
  });

  it('only looks at code spans on the current line', () => {
    expect(inline('`x\ny|`')).toBe('`x\ny`|``');
  });

  it('uses longer ticks and padding when the text has backticks', () => {
    expect(inline('[a`b]')).toBe('``[a`b]``');
    expect(inline('[`a]')).toBe('`` [`a] ``');
  });

  it('unwraps when the selection is exactly an existing code span', () => {
    expect(inline('[`x`]')).toBe('[x]');
  });

  it('round-trips with padding', () => {
    expect(inline('`` `x|` ``')).toBe('`x|`');
  });
});

describe('toggleCode (Ctrl+Shift+C)', () => {
  const smart = (m: string) => run(m, toggleCode);

  it('uses inline code within one line', () => {
    expect(smart('a [b] c')).toBe('a `[b]` c');
  });

  it('uses a code block for a multi-line selection', () => {
    expect(smart('[a\nb]')).toBe('```\n[a\nb]\n```\n');
  });

  it('treats a whole-line selection (ending at the next line) as inline', () => {
    expect(smart('[abc\n]d')).toBe('`[abc]`\nd');
  });

  it('removes the code block when the caret is inside one', () => {
    expect(smart('```\nx|\n```')).toBe('x|');
  });
});
