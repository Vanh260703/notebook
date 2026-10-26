'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '@/lib/api/health';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

/** Trạng thái API + DB, một dòng ở cuối sidebar / sheet "Thêm". Bấm để kiểm tra lại. */
export function HealthStatus({ className }: { className?: string }) {
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: qk.health,
    queryFn: fetchHealth,
    retry: false,
  });

  const ok = !isPending && !error && data?.db === 'up';
  const text = isPending
    ? 'Đang kiểm tra…'
    : error
      ? 'API không kết nối được'
      : data?.db === 'up'
        ? 'API và DB hoạt động'
        : 'API chạy, DB mất kết nối';
  const color = isPending ? 'bg-muted-foreground/40' : ok ? 'bg-success' : 'bg-destructive';

  return (
    <button
      type="button"
      onClick={() => void refetch()}
      disabled={isFetching}
      title="Kiểm tra lại"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60 pointer-coarse:py-2',
        className,
      )}
    >
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', color)} />
      {isFetching && !isPending ? 'Đang kiểm tra…' : text}
    </button>
  );
}
