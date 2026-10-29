'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, CircleAlert, Clock, SquarePen, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useRef } from 'react';
import { MarkdownPreview } from '@/components/editor/markdown-preview';
import { EmptyState } from '@/components/empty-state';
import { NoteEditorSkeleton } from '@/components/notes/note-editor-skeleton';
import { TagChip, TypeLabel } from '@/components/notes/note-meta';
import { QueryError } from '@/components/query-error';
import { TocAside, TocSheet, useActiveHeading, useToc } from '@/components/reading/toc';
import { Button, buttonVariants } from '@/components/ui/button';
import { GuardedLink } from '@/components/unsaved-guard';
import { isApiError } from '@/lib/api/client';
import { getNote } from '@/lib/api/notes';
import { formatEntryDate, formatTrashExpiry } from '@/lib/date';
import { qk } from '@/lib/query-keys';
import { formatCount, readingMinutes, wordCount } from '@/lib/reading';

/**
 * Chế độ đọc /notes/<id>/read: cột chữ 68ch căn giữa (chỗ duy nhất căn giữa, vì đọc văn bản dài
 * cần cột hẹp), chữ 17px → 18px, mục lục từ heading, thời gian đọc ước tính.
 * Dữ liệu dùng chung cache qk.note(id) với editor. Note trong thùng rác vẫn đọc được, có banner.
 */
export function ReadingView({ id }: { id: string }) {
  const router = useRouter();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: qk.note(id),
    queryFn: () => getNote(id),
  });
  const articleRef = useRef<HTMLElement>(null);
  const toc = useToc(articleRef, data?.content);
  const tocIds = useMemo(() => (toc.length >= 2 ? toc.map((t) => t.id) : NO_IDS), [toc]);
  const active = useActiveHeading(tocIds);

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push('/notes');
  };

  const bar = (
    <div className="sticky top-0 z-30 -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] mb-2 flex items-center gap-2 border-b bg-background/90 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur md:-mx-8 md:-mt-6 md:px-8">
      <Button variant="ghost" size="sm" onClick={back} className="text-muted-foreground">
        <ArrowLeft aria-hidden />
        Quay lại
      </Button>
      {data ? (
        <div className="ml-auto flex items-center gap-2">
          {/* Dưới xl: mục lục trên thanh dính, mở lại được ở giữa bài. */}
          {tocIds.length ? <TocSheet items={toc} active={active} /> : null}
          <GuardedLink
            href={`/notes/${id}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <SquarePen aria-hidden />
            Sửa
          </GuardedLink>
        </div>
      ) : null}
    </div>
  );

  if (isPending) {
    return (
      <div className="w-full max-w-6xl">
        {bar}
        <NoteEditorSkeleton />
      </div>
    );
  }

  if (error) {
    const notFound = isApiError(error) && (error.status === 404 || error.status === 400);
    return (
      <div className="flex w-full max-w-3xl flex-col gap-4">
        {bar}
        <h1 className="sr-only">{notFound ? 'Không tìm thấy note' : 'Không tải được note'}</h1>
        {notFound ? (
          <EmptyState
            icon={CircleAlert}
            title="Không tìm thấy note"
            text="Note có thể đã bị xóa vĩnh viễn, hoặc đường dẫn không đúng."
            action={
              <GuardedLink href="/notes" className={buttonVariants({ variant: 'outline' })}>
                <ArrowLeft aria-hidden />
                Về danh sách
              </GuardedLink>
            }
          />
        ) : (
          <QueryError error={error} onRetry={() => void refetch()} title="Không tải được note" />
        )}
      </div>
    );
  }

  const words = wordCount(data.content);
  const minutes = readingMinutes(words);

  return (
    <div className="w-full max-w-6xl" data-reading>
      {bar}
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_14rem] xl:gap-10">
        <article
          ref={articleRef}
          className="mx-auto flex w-full max-w-[68ch] flex-col gap-4 pt-4 pb-16"
        >
          {data.deletedAt ? (
            <div
              role="status"
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm"
            >
              <Trash2 className="size-4 shrink-0 text-warning" aria-hidden />
              <span className="mr-auto">
                Note này đang trong thùng rác. {formatTrashExpiry(data.deletedAt).sentence}
              </span>
              <GuardedLink
                href={`/notes/${id}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Mở để khôi phục
              </GuardedLink>
            </div>
          ) : null}
          <header className="flex flex-col gap-3">
            <h1
              tabIndex={-1}
              className="text-3xl leading-tight font-bold tracking-[-0.02em] break-words md:text-4xl"
            >
              {data.title || <span className="text-muted-foreground">Không có tiêu đề</span>}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
              <TypeLabel type={data.type} />
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <CalendarDays className="size-3.5" aria-hidden />
                <span className="sr-only">Ngày của note: </span>
                {formatEntryDate(data.entryDate)}
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />≈ {minutes} phút đọc
              </span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{formatCount(words)} chữ</span>
              {data.tags.length ? (
                <span className="flex flex-wrap gap-1.5 text-xs">
                  <span className="sr-only">Tag:</span>
                  {data.tags.map((t) => (
                    <TagChip key={t.id} name={t.name} />
                  ))}
                </span>
              ) : null}
            </div>
          </header>
          <hr className="border-border" />
          <MarkdownPreview content={data.content} variant="reading" />
        </article>
        {toc.length >= 2 ? (
          <aside className="hidden xl:block">
            <TocAside items={toc} active={active} />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

const NO_IDS: string[] = [];
