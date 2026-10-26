import type { ReactNode } from 'react';

/** Header của trang danh sách (không dính, cuộn theo nội dung). */
export function PageHeader({
  title,
  count,
  unit = 'note',
  description,
}: {
  title: string;
  count?: number;
  unit?: string;
  description?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1">
      {/* tabIndex -1: nhận focus khi gỡ card cuối cùng trong danh sách (lib/list-focus). */}
      <h1
        tabIndex={-1}
        className="rounded-sm text-2xl leading-tight font-bold tracking-[-0.02em] md:text-[1.75rem]"
      >
        {title}
        {count !== undefined ? (
          <span className="ml-2 align-middle text-base font-medium text-muted-foreground tabular-nums">
            {count}
            <span className="sr-only"> {unit}</span>
          </span>
        ) : null}
      </h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </header>
  );
}
