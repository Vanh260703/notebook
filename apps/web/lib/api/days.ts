import type { DayCountsResponse } from '@notebook/shared';
import { apiFetch, toQueryString } from './client';

/** Số note theo ngày trong [from, to] (chỉ những ngày có note). */
export const listDays = (from: string, to: string, signal?: AbortSignal) =>
  apiFetch<DayCountsResponse>(`/days${toQueryString({ from, to })}`, { signal });
