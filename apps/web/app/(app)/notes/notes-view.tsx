'use client';

import {
  NOTE_STATUSES,
  NOTE_TYPES,
  noteStatusSchema,
  noteTypeSchema,
  type ListNotesQuery,
  type NoteStatus,
  type NoteType,
} from '@notebook/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Inbox, ListFilter, NotebookPen, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { EmptyState } from '@/components/empty-state';
import { NoteList } from '@/components/notes/note-list';
import { NoteListSkeleton } from '@/components/notes/note-list-skeleton';
import { STATUS_META, TYPE_META } from '@/components/notes/note-meta';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { QueryError } from '@/components/query-error';
import { Button, buttonVariants } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { GuardedLink } from '@/components/unsaved-guard';
import { listNotes } from '@/lib/api/notes';
import { listTags } from '@/lib/api/tags';
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/labels';
import { pageCount, pageParam, parsePage } from '@/lib/list-params';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

export type NotesScope = 'all' | 'inbox';

const PAGE_TITLE: Record<NotesScope, string> = { all: 'Ghi chú', inbox: 'Inbox' };
const PAGE_DESCRIPTION: Record<NotesScope, string | null> = {
  all: null,
  inbox: 'Note mới và ghi nhanh nằm ở đây. Gắn tag, chọn loại rồi chuyển sang Đang dùng.',
};

// Icon trong bộ lọc chỉ hiện từ md: trên điện thoại 4 nút trạng thái phải vừa một hàng.
const filterIcon = 'hidden size-3.5 md:block';

const STATUS_OPTIONS: SegmentedOption<NoteStatus | ''>[] = [
  { value: '', label: 'Tất cả' },
  ...NOTE_STATUSES.map((s) => {
    const { icon: Icon, text } = STATUS_META[s];
    return {
      value: s,
      label: STATUS_LABEL[s],
      icon: <Icon className={cn(filterIcon, text)} aria-hidden />,
    };
  }),
];

const TYPE_OPTIONS: SegmentedOption<NoteType | ''>[] = [
  { value: '', label: 'Tất cả' },
  ...NOTE_TYPES.map((t) => {
    const { icon: Icon, text } = TYPE_META[t];
    return {
      value: t,
      label: TYPE_LABEL[t],
      icon: <Icon className={cn(filterIcon, text)} aria-hidden />,
    };
  }),
];

/** Khung trang khi đang chờ (Suspense fallback): cùng header để không nhảy layout. */
export function NotesViewFallback({ scope = 'all' }: { scope?: NotesScope }) {
  return (
    <div className="flex w-full max-w-5xl flex-col gap-5 md:gap-6">
      <PageHeader title={PAGE_TITLE[scope]} description={PAGE_DESCRIPTION[scope]} />
      <NoteListSkeleton />
    </div>
  );
}

/**
 * Danh sách note, bộ lọc nằm trên URL: ?tag=&type=&status=&page=
 * `scope="inbox"`: trang Inbox, cố định status INBOX (bỏ qua ?status) và ẩn bộ lọc trạng thái.
 */
export function NotesView({ scope = 'all' }: { scope?: NotesScope }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const inbox = scope === 'inbox';

  // Giá trị lạ trên URL thì bỏ qua thay vì gửi lên để nhận 400.
  const query: ListNotesQuery = {
    tag: sp.get('tag') || undefined,
    type: noteTypeSchema.safeParse(sp.get('type')).data,
    status: inbox ? 'INBOX' : noteStatusSchema.safeParse(sp.get('status')).data,
    page: parsePage(sp.get('page')),
    limit: PAGE_SIZE,
  };

  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: qk.noteList(query),
    queryFn: () => listNotes(query),
    placeholderData: keepPreviousData,
  });
  const tags = useQuery({ queryKey: qk.tags, queryFn: listTags, staleTime: 60_000 });

  const setParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const changingPage = 'page' in patch;
    if (!changingPage) next.delete('page'); // đổi bộ lọc thì về trang 1
    const s = next.toString();
    const url = s ? `${pathname}?${s}` : pathname;
    // Đổi trang: push (Back quay về trang trước) và cuộn lên đầu như mặc định.
    // Đổi bộ lọc: replace, giữ vị trí cuộn.
    if (changingPage) router.push(url);
    else router.replace(url, { scroll: false });
  };

  const hasFilter = Boolean(query.tag || query.type || (!inbox && query.status));
  const clearFilters = () => setParams({ tag: undefined, type: undefined, status: undefined });
  const page = query.page ?? 1;

  const tagSelect = (
    <NativeSelect
      aria-label="Lọc theo tag"
      value={query.tag ?? ''}
      onChange={(e) => setParams({ tag: e.target.value || undefined })}
      className="min-w-0 flex-1 md:max-w-48 md:flex-none"
    >
      <option value="">Mọi tag</option>
      {query.tag && !tags.data?.items.some((t) => t.name === query.tag) ? (
        <option value={query.tag}>#{query.tag}</option>
      ) : null}
      {tags.data?.items.map((t) => (
        <option key={t.id} value={t.name}>
          #{t.name} ({t.noteCount})
        </option>
      ))}
    </NativeSelect>
  );

  const empty = hasFilter ? (
    <EmptyState
      icon={ListFilter}
      title="Không có note nào khớp bộ lọc"
      action={
        <Button variant="outline" onClick={clearFilters}>
          <X aria-hidden />
          Bỏ lọc
        </Button>
      }
    />
  ) : inbox ? (
    <EmptyState
      icon={Inbox}
      iconClassName="bg-status-active-bg text-status-active"
      title="Inbox trống"
      text="Mọi note đã được sắp xếp."
    />
  ) : (
    <EmptyState
      icon={NotebookPen}
      title="Chưa có note nào"
      text="Ghi lại điều vừa học hay một ý tưởng. Note mới vào Inbox để sắp xếp sau."
      action={
        <GuardedLink href="/notes/new" className={buttonVariants()}>
          Viết note đầu tiên
        </GuardedLink>
      }
    />
  );

  return (
    <div className="flex w-full max-w-5xl flex-col gap-5 md:gap-6">
      <PageHeader
        title={PAGE_TITLE[scope]}
        count={data?.total}
        description={PAGE_DESCRIPTION[scope]}
      />

      {/* Desktop: một hàng. Mobile: trạng thái một hàng riêng (4 ô), loại + tag hàng dưới. */}
      <div className="flex flex-wrap items-center gap-2">
        {!inbox ? (
          <Segmented
            label="Lọc theo trạng thái"
            value={query.status ?? ''}
            onChange={(v) => setParams({ status: v || undefined })}
            options={STATUS_OPTIONS}
            className="grid w-full grid-cols-4 md:inline-flex md:w-auto"
            itemClassName="px-1.5 md:px-2.5"
          />
        ) : null}
        <div className="flex w-full min-w-0 items-center gap-2 md:contents">
          <Segmented
            label="Lọc theo loại"
            value={query.type ?? ''}
            onChange={(v) => setParams({ type: v || undefined })}
            options={TYPE_OPTIONS}
            itemClassName="px-2 md:px-2.5"
          />
          {tagSelect}
        </div>
        {hasFilter ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X aria-hidden />
            Bỏ lọc
          </Button>
        ) : null}
      </div>

      {error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <NoteListSkeleton />
      ) : data.items.length === 0 ? (
        empty
      ) : (
        <div className={cn(isFetching && 'opacity-70 transition-opacity')}>
          <NoteList
            items={data.items}
            onTagClick={(tag) => setParams({ tag })}
            showStatus={!inbox}
          />
        </div>
      )}

      {data && (page > 1 || data.hasMore) ? (
        <Pagination
          page={page}
          pages={pageCount(data.total, PAGE_SIZE)}
          hasMore={data.hasMore}
          onPage={(p) => setParams({ page: pageParam(p) })}
        />
      ) : null}
    </div>
  );
}
