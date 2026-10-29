import { slugify } from './reading';

/** Phần tối thiểu của cây hast mà plugin dùng (không thêm dependency @types/hast). */
export interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const HEADING = /^h([1-6])$/;

const textOf = (n: HastNode): string =>
  n.type === 'text' ? (n.value ?? '') : (n.children ?? []).map(textOf).join('');

/**
 * Plugin rehype cho chế độ đọc (không dependency):
 * - Lùi heading một bậc: trang chỉ có một h1 là tiêu đề note, nên `#` thành h2; h6 giữ h6.
 * - Gán `id` từ chữ của heading (slugify), trùng thì thêm -2, -3… để mục lục nhảy đúng chỗ.
 */
export function rehypeHeadingIds() {
  return (tree: HastNode) => {
    const used = new Set<string>();
    const walk = (node: HastNode) => {
      const m = node.type === 'element' && node.tagName ? HEADING.exec(node.tagName) : null;
      if (m) {
        node.tagName = `h${Math.min(6, Number(m[1]) + 1)}`;
        const base = slugify(textOf(node));
        let id = base;
        for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
        used.add(id);
        node.properties = { ...node.properties, id };
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}
