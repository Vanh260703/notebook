import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { rehypeHeadingIds } from '@/lib/rehype-heading-ids';
import { cn } from '@/lib/utils';

// KHÔNG thêm rehype-raw: HTML trong note sẽ được render thật, mở đường XSS.
const components: Components = {
  // Link nội bộ (#muc) nhảy trong trang; link khác mở tab mới.
  a: ({ node: _node, href, ...props }) =>
    href?.startsWith('#') ? (
      <a href={href} {...props} />
    ) : (
      <a href={href} {...props} target="_blank" rel="noopener noreferrer" />
    ),
  // Bảng rộng cuộn ngang trong khung riêng, không đẩy cả trang. Khung cuộn và khối code nhận
  // focus (tabIndex 0) để cuộn được bằng bàn phím (WCAG 2.1.1, axe scrollable-region-focusable).
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto" tabIndex={0}>
      <table {...props} />
    </div>
  ),
  pre: ({ node: _node, ...props }) => <pre tabIndex={0} {...props} />,
};

type Plugins = NonNullable<Options['rehypePlugins']>;
const PREVIEW_PLUGINS: Plugins = [[rehypeHighlight, { detect: false }]];
const READING_PLUGINS: Plugins = [[rehypeHighlight, { detect: false }], rehypeHeadingIds];

/**
 * - `preview`: khung xem trước trong editor (prose-sm).
 * - `reading`: chế độ đọc: chữ lớn (17px, 18px từ md), heading lùi một bậc và có id cho mục lục.
 */
export function MarkdownPreview({
  content,
  className,
  variant = 'preview',
}: {
  content: string;
  className?: string;
  variant?: 'preview' | 'reading';
}) {
  const reading = variant === 'reading';
  return (
    <div
      className={cn(
        // Màu prose lấy từ token (globals.css), không cần dark:prose-invert.
        'prose max-w-none prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-lg prose-pre:border',
        reading
          ? 'text-[1.0625rem] md:prose-lg md:text-[1.125rem] prose-headings:scroll-mt-20 prose-pre:overflow-x-auto'
          : 'prose-sm',
        // Code inline dạng chip cam như Slack; code trong khối <pre> thì không (pre đã có nền và padding).
        '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:border [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-code-inline',
        className,
      )}
    >
      {content.trim() ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={reading ? READING_PLUGINS : PREVIEW_PLUGINS}
          components={components}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <p className="text-muted-foreground">Chưa có nội dung.</p>
      )}
    </div>
  );
}
