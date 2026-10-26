import { cn } from '@/lib/utils';

/** Khối giữ chỗ khi đang tải (trang trí, aria-hidden; vùng chứa tự báo "Đang tải…"). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-muted motion-reduce:animate-none', className)}
    />
  );
}
