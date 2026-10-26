import { Skeleton } from '@/components/ui/skeleton';

/** Khung editor khi đang tải note (cùng bố cục với NoteForm để không nhảy layout). */
export function NoteEditorSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex w-full max-w-7xl flex-col gap-3">
      <span className="sr-only">Đang tải…</span>
      <Skeleton className="h-12" />
      <Skeleton className="h-8 w-1/2" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-48 rounded-lg" />
      </div>
      <div className="h-[60dvh] rounded-xl border bg-card shadow-elev-1" />
    </div>
  );
}
