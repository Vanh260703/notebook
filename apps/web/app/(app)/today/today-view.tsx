'use client';

import { LIST_LIMIT_MAX, type ListNotesQuery, type NoteListItem } from '@notebook/shared';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Plus, Zap } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { MonthCalendar } from '@/components/calendar/month-calendar';
import { CaptureComposer } from '@/components/capture/capture-composer';
import { useCommands } from '@/components/command/command-provider';
import { WeekStrip } from '@/components/calendar/week-strip';
import { EmptyState } from '@/components/empty-state';
import { NoteListSkeleton } from '@/components/notes/note-list-skeleton';
import { Pagination } from '@/components/pagination';
import { QueryError } from '@/components/query-error';
import { useOutbox } from '@/components/outbox/outbox-provider';
import { Timeline, type PendingEntry } from '@/components/today/timeline';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { GuardedLink } from '@/components/unsaved-guard';
import { listNotes } from '@/lib/api/notes';
import { addDays, isValidYmd } from '@/lib/calendar';
import { formatDayTitle, formatLongDay } from '@/lib/date';
import { pageCount } from '@/lib/list-params';
import { qk } from '@/lib/query-keys';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';

const PAGE_SIZE = LIST_LIMIT_MAX;

/** Khung khi chưa biết "hôm nay" (render trên server / trước khi hydrate). */
export function TodayViewFallback() {
  return (
    <div className="flex w-full max-w-5xl flex-col gap-5 md:gap-6">
      <header className="flex flex-col gap-1">
        <h1
          tabIndex={-1}
          className="rounded-sm text-2xl leading-tight font-bold tracking-[-0.02em] md:text-[1.75rem]"
        >
          Hôm nay
        </h1>
        <Skeleton className="h-4 w-48" />
      </header>
      <NoteListSkeleton rows={3} />
    </div>
  );
}

/**
 * Trang theo ngày: /today (hôm nay) và /today?date=YYYY-MM-DD. "Hôm nay" chỉ tính ở client
 * (useToday), ?date= sai thì coi như hôm nay. Đổi ngày dùng push (Back về ngày trước).
 * Note của ngày: GET /notes?date= (sắp theo giờ ghi, gồm cả note lưu trữ).
 */
export function TodayView() {
  const today = useToday();
  if (!today) return <TodayViewFallback />;
  return <TodayContent today={today} />;
}

function TodayContent({ today }: { today: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const param = sp.get('date');
  const date = isValidYmd(param) ? param : today;
  const isToday = date === today;

  const [page, setPage] = useState(1);
  const [prevDate, setPrevDate] = useState(date);
  if (date !== prevDate) {
    setPrevDate(date);
    setPage(1);
  }
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { openCapture } = useCommands();
  const { records } = useOutbox();
  // Note chờ gửi của ngày này, xen vào dòng thời gian theo giờ ghi.
  const pending: PendingEntry[] = records
    .filter((r) => r.input.entryDate === date)
    .map((r) => ({
      id: r.id,
      title: r.input.title ?? '',
      content: r.input.content ?? '',
      type: r.input.type ?? 'LEARNING',
      createdAt: r.queuedAt,
      failed: r.state === 'failed',
    }));

  const query: ListNotesQuery = { date, page, limit: PAGE_SIZE };
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: qk.noteList(query),
    queryFn: ({ signal }) => listNotes(query, signal),
  });
  const shown = data ?? null;

  const goTo = (ymd: string) => {
    setCalendarOpen(false);
    if (ymd === date) return;
    router.push(ymd === today ? '/today' : `/today?date=${ymd}`);
  };

  const newNoteHref = `/notes/new?date=${date}`;
  const readAction = (note: NoteListItem) => (
    <GuardedLink
      href={`/notes/${note.id}/read`}
      aria-label={`Đọc ${note.title || 'note không có tiêu đề'}`}
      title="Chế độ đọc"
      className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
    >
      <BookOpen />
    </GuardedLink>
  );
  const count = shown?.total;

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 md:gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <div className="mr-auto flex min-w-0 flex-col gap-1">
            <h1
              tabIndex={-1}
              className="rounded-sm text-2xl leading-tight font-bold tracking-[-0.02em] md:text-[1.75rem]"
            >
              {formatDayTitle(date, today)}
            </h1>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {formatLongDay(date)}
              {count !== undefined ? (
                <>
                  {' '}
                  · <span className="tabular-nums">{count}</span> note
                </>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goTo(addDays(date, -1))}
              aria-label="Ngày trước"
              title="Ngày trước"
              className="hidden lg:inline-flex"
            >
              <ChevronLeft />
            </Button>
            {!isToday ? (
              <Button variant="outline" size="sm" onClick={() => goTo(today)}>
                Về hôm nay
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goTo(addDays(date, 1))}
              aria-label="Ngày sau"
              title="Ngày sau"
              className="hidden lg:inline-flex"
            >
              <ChevronRight />
            </Button>
            <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
              <DialogTrigger
                render={<Button variant="outline" size="sm" className="lg:hidden" />}
                aria-haspopup="dialog"
              >
                <CalendarDays aria-hidden />
                Lịch
              </DialogTrigger>
              <DialogContent className="pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                <DialogHeader>
                  <DialogTitle>Chọn ngày</DialogTitle>
                </DialogHeader>
                <MonthCalendar selected={date} today={today} onSelect={goTo} />
              </DialogContent>
            </Dialog>
            <GuardedLink
              href={newNoteHref}
              // cn gộp class: `hidden` phải thắng `inline-flex` có sẵn trong buttonVariants.
              className={cn(buttonVariants({ size: 'sm' }), 'hidden lg:inline-flex')}
            >
              <Plus aria-hidden />
              Note mới cho ngày này
            </GuardedLink>
          </div>
        </header>

        <div className="lg:hidden">
          <WeekStrip selected={date} today={today} onSelect={goTo} />
        </div>

        {/* Ghi nhanh vào ngày đang xem. Desktop: ô nhập ngay trong trang. Mobile: nút trông như ô
            nhập, mở sheet (bàn phím không bật lên ngay khi vừa mở trang). */}
        <div className="hidden rounded-xl border bg-card p-3 shadow-elev-1 lg:block">
          <CaptureComposer
            key={date}
            date={date}
            placeholder={isToday ? 'Ghi nhanh vào hôm nay…' : 'Ghi nhanh vào ngày này…'}
          />
        </div>
        <button
          type="button"
          onClick={() => openCapture(date)}
          aria-haspopup="dialog"
          className="flex h-11 items-center gap-2 rounded-lg border border-input bg-field px-3 text-left text-base text-muted-foreground lg:hidden"
        >
          <Zap className="size-4 shrink-0 text-primary-ink" aria-hidden />
          {isToday ? 'Ghi nhanh vào hôm nay…' : 'Ghi nhanh vào ngày này…'}
        </button>

        {/* Server lỗi (ở nhà đang tắt): vẫn hiện note đã tải trước đó và note chờ gửi. */}
        {error ? (
          <QueryError error={error} onRetry={() => void refetch()} title="Không tải được note" />
        ) : null}
        {!error && (isPending || !shown) ? (
          <NoteListSkeleton rows={3} />
        ) : !error && shown && shown.items.length === 0 && pending.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Chưa có note nào ngày này"
            action={
              <GuardedLink href={newNoteHref} className={buttonVariants()}>
                <Plus aria-hidden />
                Viết note cho ngày này
              </GuardedLink>
            }
          />
        ) : (shown?.items.length ?? 0) + pending.length > 0 ? (
          <div className={cn(isFetching && 'opacity-70 transition-opacity')}>
            <Timeline
              date={date}
              items={shown?.items ?? []}
              pending={pending}
              actions={readAction}
            />
          </div>
        ) : null}

        {shown && (page > 1 || shown.hasMore) ? (
          <Pagination
            page={page}
            pages={pageCount(shown.total, PAGE_SIZE)}
            hasMore={shown.hasMore}
            onPage={setPage}
          />
        ) : null}
      </div>

      <aside
        aria-label="Lịch"
        className="sticky top-6 hidden rounded-xl border bg-card p-3 shadow-elev-1 lg:block"
      >
        <MonthCalendar selected={date} today={today} onSelect={goTo} />
      </aside>
    </div>
  );
}
