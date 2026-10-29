import { describe, expect, it } from 'vitest';
import { toggleCodeBlock, type TextEdit } from './code-block';

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

/** Doc viết kèm vùng chọn: `|` là con trỏ, `[...]` là vùng chọn. */
function run(marked: string): string {
  const caret = marked.indexOf('|');
  if (caret >= 0) {
    const doc = marked.replace('|', '');
    return apply(doc, toggleCodeBlock(doc, caret, caret));
  }
  const from = marked.indexOf('[');
  const to = marked.indexOf(']') - 1;
  const doc = marked.replace('[', '').replace(']', '');
  return apply(doc, toggleCodeBlock(doc, from, to));
}

describe('toggleCodeBlock', () => {
  it('opens an empty block on an empty line, caret inside', () => {
    expect(run('Lệnh:\n|')).toBe('Lệnh:\n```\n|\n```');
  });

  it('wraps the current line and keeps the caret on the same text', () => {
    expect(run('a\ndocker p|s\nb')).toBe('a\n```\ndocker p|s\n```\nb');
  });

  it('wraps every line the selection touches, keeping the selection', () => {
    expect(run('x\ndoc[ker ps\ndocker lo]gs\ny')).toBe('x\n```\ndoc[ker ps\ndocker lo]gs\n```\ny');
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
    expect(run('[```js\nx\n```\ny]')).toBe('````\n[```js\nx\n```\ny]\n````');
  });

  it('does not treat ~~~ as closing a ``` block', () => {
    expect(run('```\n~~~\nx|\n```')).toBe('~~~\nx|');
  });
});
