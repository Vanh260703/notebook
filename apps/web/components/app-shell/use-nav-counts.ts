'use client';

import type { ListNotesQuery } from '@notebook/shared';
import { useQuery } from '@tanstack/react-query';
import { listNotes } from '@/lib/api/notes';
import { listTags } from '@/lib/api/tags';
import { qk } from '@/lib/query-keys';
import { useHydrated } from '@/lib/use-hydrated';
import { NAV_COUNT_QUERIES, type NavKey } from './nav';

const useCount = (q: ListNotesQuery) =>
  useQuery({
    queryKey: qk.noteList(q),
    queryFn: () => listNotes(q),
    select: (d) => d.total,
    staleTime: 30_000,
  }).data;

const NO_COUNTS: Record<NavKey, undefined> = {
  today: undefined,
  inbox: undefined,
  notes: undefined,
  tags: undefined,
  trash: undefined,
};

/**
 * Số đếm cho sidebar và tab bar, chỉ dùng API có sẵn: 3 request GET /notes?limit=1 (đọc `total`)
 * và GET /tags (dùng chung cache với trang Tag, ô nhập tag). `undefined` khi đang tải, khi lỗi,
 * và trong lúc hydrate (xem useHydrated: sidebar nằm trong Suspense, có thể hydrate muộn).
 */
export function useNavCounts(): Record<NavKey, number | undefined> {
  const hydrated = useHydrated();
  const notes = useCount(NAV_COUNT_QUERIES.notes);
  const inbox = useCount(NAV_COUNT_QUERIES.inbox);
  const trash = useCount(NAV_COUNT_QUERIES.trash);
  const tags = useTags()?.length;
  // "Hôm nay" không có số trong sidebar (số note của ngày nằm ở đầu trang).
  return hydrated ? { today: undefined, notes, inbox, trash, tags } : NO_COUNTS;
}

/** GET /tags, cùng key/staleTime với các chỗ khác. Danh sách tag rỗng (undefined) khi chưa hydrate. */
export function useTags() {
  const hydrated = useHydrated();
  const q = useQuery({ queryKey: qk.tags, queryFn: listTags, staleTime: 60_000 });
  return hydrated ? q.data?.items : undefined;
}
