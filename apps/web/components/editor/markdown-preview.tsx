import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

// KHÔNG thêm rehype-raw: HTML trong note sẽ được render thật, mở đường XSS.
const components: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

export function MarkdownPreview({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        // Màu prose lấy từ token (globals.css), không cần dark:prose-invert.
        'prose prose-sm max-w-none prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-lg prose-pre:border',
        // Code inline có nền; code trong khối <pre> thì không (pre đã có nền và padding).
        '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5',
        className,
      )}
    >
      {content.trim() ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { detect: false }]]}
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
