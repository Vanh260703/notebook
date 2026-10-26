'use client';

import type { ListNotesQuery } from '@notebook/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { EmptyState } from '@/components/empty-state';
import { NoteList } from '@/components/notes/note-list';
import { NoteListSkeleton } from '@/components/notes/note-list-skeleton';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { QueryError } from '@/components/query-error';
import { listNotes } from '@/lib/api/notes';
import { pageCount, pageParam, parsePage } from '@/lib/list-params';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;
const DESCRIPTION = 'Note đã xóa. Mở để xem, khôi phục hoặc xóa vĩnh viễn.';

export function TrashViewFallback() {
  return (
    <div className="flex w-full max-w-5xl flex-col gap-5 md:gap-6">
      <PageHeader title="Thùng rác" description={DESCRIPTION} />
      <NoteListSkeleton rows={3} />
    </div>
  );
}

/**
 * Thùng rác (chỉ dùng API có sẵn): GET /notes?trashed=true, mới xóa đứng trước.
 * Mở note là view chỉ đọc; khôi phục / xóa vĩnh viễn ngay trên card.
 * Không có "Dọn sạch thùng rác" và không đếm ngược 30 ngày (cron dọn thuộc GĐ2).
 */
export function TrashView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const page = parsePage(sp.get('page'));
  const query: ListNotesQuery = { trashed: true, page, limit: PAGE_SIZE };

  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: qk.noteList(query),
    queryFn: () => listNotes(query),
    placeholderData: keepPreviousData,
  });

  const goToPage = (p: number) => {
    const v = pageParam(p);
    router.push(v ? `${pathname}?page=${v}` : pathname);
  };

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5 md:gap-6">
      <PageHeader title="Thùng rác" count={data?.total} description={DESCRIPTION} />
      {error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <NoteListSkeleton rows={3} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={Trash2} title="Thùng rác trống" />
      ) : (
        <div className={cn(isFetching && 'opacity-70 transition-opacity')}>
          <NoteList items={data.items} variant="trash" />
        </div>
      )}
      {data && (page > 1 || data.hasMore) ? (
        <Pagination
          page={page}
          pages={pageCount(data.total, PAGE_SIZE)}
          hasMore={data.hasMore}
          onPage={goToPage}
        />
      ) : null}
    </div>
  );
}
