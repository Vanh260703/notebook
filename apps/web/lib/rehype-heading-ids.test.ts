import { describe, expect, it } from 'vitest';
import { rehypeHeadingIds, type HastNode } from './rehype-heading-ids';

const h = (tag: string, ...children: HastNode[]): HastNode => ({
  type: 'element',
  tagName: tag,
  properties: {},
  children,
});
const text = (value: string): HastNode => ({ type: 'text', value });

describe('rehypeHeadingIds', () => {
  it('shifts headings down one level (h6 stays h6) and assigns ids from nested text', () => {
    const tree: HastNode = {
      type: 'root',
      children: [
        h('h1', text('Bối cảnh')),
        h('p', text('x')),
        h('h2', text('Lỗi '), h('code', text('docker'))),
        h('h6', text('Nhỏ')),
      ],
    };
    rehypeHeadingIds()(tree);
    const [a, p, b, c] = tree.children!;
    expect(a).toMatchObject({ tagName: 'h2', properties: { id: 'boi-canh' } });
    expect(p).toMatchObject({ tagName: 'p', properties: {} });
    expect(b).toMatchObject({ tagName: 'h3', properties: { id: 'loi-docker' } });
    expect(c).toMatchObject({ tagName: 'h6', properties: { id: 'nho' } });
  });

  it('dedupes ids with -2, -3 (and avoids clashing with a literal "-2" heading)', () => {
    const tree: HastNode = {
      type: 'root',
      children: [
        h('h2', text('Ghi chú')),
        h('h2', text('Ghi chú-2')),
        h('h2', text('Ghi chú')),
        h('h2', text('Ghi chú')),
      ],
    };
    rehypeHeadingIds()(tree);
    expect(tree.children!.map((n) => n.properties?.id)).toEqual([
      'ghi-chu',
      'ghi-chu-2',
      'ghi-chu-3',
      'ghi-chu-4',
    ]);
  });
});
