/** Phần tối thiểu của cây mdast mà plugin dùng (không thêm dependency @types/mdast). */
export interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
}

/**
 * Plugin remark (không dependency): mỗi lần xuống dòng trong đoạn văn là một dòng mới (<br>), như
 * trong editor và Slack. Markdown chuẩn coi một lần xuống dòng là dấu cách nên các dòng bị dồn
 * thành một đoạn. Code (inline/block) không phải node `text` nên không bị đụng tới.
 */
export function remarkSoftBreaks() {
  return (tree: MdastNode) => {
    const walk = (node: MdastNode) => {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        if (child.type !== 'text' || !child.value?.includes('\n')) {
          walk(child);
          return [child];
        }
        const out: MdastNode[] = [];
        child.value.split('\n').forEach((part, i) => {
          if (i > 0) out.push({ type: 'break' });
          if (part) out.push({ type: 'text', value: part });
        });
        return out;
      });
    };
    walk(tree);
  };
}
