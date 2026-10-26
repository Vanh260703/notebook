import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Trạng thái rỗng: icon, tiêu đề, một dòng mô tả và (tùy chọn) một hành động. */
export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  iconClassName,
  className,
}: {
  icon: LucideIcon;
  title: string;
  text?: ReactNode;
  action?: ReactNode;
  /** Màu khối icon, mặc định nền indigo nhạt. */
  iconClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <span
        className={cn(
          'grid size-12 place-items-center rounded-2xl bg-accent text-primary-ink',
          iconClassName,
        )}
      >
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      {text ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
