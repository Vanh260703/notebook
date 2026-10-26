'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { NoteEditorSkeleton } from '@/components/notes/note-editor-skeleton';
import { NoteForm } from '@/components/notes/note-form';
import { QueryError } from '@/components/query-error';
import { buttonVariants } from '@/components/ui/button';
import { GuardedLink } from '@/components/unsaved-guard';
import { isApiError } from '@/lib/api/client';
import { getNote } from '@/lib/api/notes';
import { qk } from '@/lib/query-keys';

export function NoteDetail({ id }: { id: string }) {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: qk.note(id),
    queryFn: () => getNote(id),
  });

  if (isPending) return <NoteEditorSkeleton />;

  if (error) {
    const notFound = isApiError(error) && (error.status === 404 || error.status === 400);
    const back = (
      <GuardedLink href="/notes" className={buttonVariants({ variant: 'outline' })}>
        <ArrowLeft aria-hidden />
        Về danh sách
      </GuardedLink>
    );
    if (notFound) {
      return (
        <div className="w-full max-w-3xl">
          {/* h1 cho trang (đọc màn hình và đích focus), khối trạng thái giữ kiểu EmptyState. */}
          <h1 className="sr-only">Không tìm thấy note</h1>
          <EmptyState
            icon={CircleAlert}
            title="Không tìm thấy note"
            text="Note có thể đã bị xóa vĩnh viễn, hoặc đường dẫn không đúng."
            action={back}
          />
        </div>
      );
    }
    return (
      <div className="flex w-full max-w-3xl flex-col gap-4">
        <h1 className="sr-only">Không tải được note</h1>
        <QueryError error={error} onRetry={() => void refetch()} title="Không tải được note" />
        <div>{back}</div>
      </div>
    );
  }

  // NoteForm chỉ khởi tạo state một lần theo id: refetch không ghi đè thay đổi chưa lưu.
  return <NoteForm key={data.id} mode="edit" note={data} />;
}
