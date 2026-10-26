import { Skeleton } from '@/components/ui/skeleton';

/** Khung danh sách khi đang tải (cũng dùng trong Suspense fallback của trang). */
export function NoteListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2 md:gap-2.5">
      <span className="sr-only">Đang tải…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 shadow-elev-1">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="mt-2.5 h-3 w-4/5" />
          <Skeleton className="mt-1.5 h-3 w-3/5" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
