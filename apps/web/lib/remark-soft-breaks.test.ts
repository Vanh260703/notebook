import { describe, expect, it } from 'vitest';
import { remarkSoftBreaks, type MdastNode } from './remark-soft-breaks';

const run = (tree: MdastNode) => {
  remarkSoftBreaks()(tree);
  return tree;
};

describe('remarkSoftBreaks', () => {
  it('turns newlines inside a paragraph into breaks', () => {
    const tree = run({
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'Chia: ' },
            { type: 'inlineCode', value: 'Ctrl + O' },
            { type: 'text', value: '\nMở tab: ' },
            { type: 'inlineCode', value: 'Ctrl + T' },
          ],
        },
      ],
    });
    expect(tree.children![0]!.children!.map((n) => n.type)).toEqual([
      'text',
      'inlineCode',
      'break',
      'text',
      'inlineCode',
    ]);
    expect(tree.children![0]!.children![3]).toEqual({ type: 'text', value: 'Mở tab: ' });
  });

  it('reaches text nested in emphasis and leaves code untouched', () => {
    const tree = run({
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'strong', children: [{ type: 'text', value: 'a\nb' }] }],
        },
        { type: 'code', value: 'x\ny' },
      ],
    });
    expect(tree.children![0]!.children![0]!.children).toEqual([
      { type: 'text', value: 'a' },
      { type: 'break' },
      { type: 'text', value: 'b' },
    ]);
    expect(tree.children![1]).toEqual({ type: 'code', value: 'x\ny' });
  });
});
