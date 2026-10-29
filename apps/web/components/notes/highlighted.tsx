import { splitHighlight } from '@notebook/shared';
import { cn } from '@/lib/utils';

/**
 * Chuỗi có marker highlight (từ API) thành text + <mark> bằng React. KHÔNG dùng
 * dangerouslySetInnerHTML: chuỗi là nội dung note, có thể chứa HTML.
 */
export function Highlighted({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {splitHighlight(text).map((p, i) =>
        p.hit ? (
          <mark key={i} className={markClass}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}

export const markClass = cn('rounded-[3px] bg-mark px-0.5 text-foreground');
