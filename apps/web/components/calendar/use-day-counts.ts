'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listDays } from '@/lib/api/days';
import { qk } from '@/lib/query-keys';

/** Số note theo ngày trong [from, to] dạng Map (ngày không có note: không có key). */
export function useDayCounts(from: string, to: string): Map<string, number> | undefined {
  return useQuery({
    queryKey: qk.dayRange(from, to),
    queryFn: ({ signal }) => listDays(from, to, signal),
    select: (d) => new Map(d.items.map((i) => [i.date, i.count])),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  }).data;
}

/** "Thứ Ba, 27 tháng 10, 3 note" (nhãn đọc màn hình của một ô lịch). */
export const dayCountLabel = (long: string, count: number | undefined): string =>
  count ? `${long}, ${count} note` : `${long}, không có note`;
