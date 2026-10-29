import { ApiError } from '../api/client';

/**
 * - transient: thử lại sau (mạng, server ở nhà tắt: Vercel trả 5xx, 408, 429, 409 CONFLICT do race
 *   khi tạo tag).
 * - auth: hết phiên (401), giữ lại chờ đăng nhập.
 * - permanent: 400, 413, 404, 409 VERSION_CONFLICT... thử lại cũng vậy, cần người dùng xử lý.
 */
export type ErrorKind = 'transient' | 'auth' | 'permanent';

export function classifyError(e: unknown): ErrorKind {
  if (!(e instanceof ApiError)) return 'transient'; // AbortError, TypeError lạ: coi như mạng
  const { status, code } = e;
  if (status === 0 || status === 408 || status === 429 || status >= 500) return 'transient';
  if (status === 401) return 'auth';
  if (status === 409 && code !== 'VERSION_CONFLICT') return 'transient';
  return 'permanent';
}

export const BACKOFF_BASE_MS = 5_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

/** Chờ trước lần thử thứ `attempts + 1`: 5, 10, 20, 40, 80, 160, 300, 300… giây. */
export const backoffMs = (attempts: number): number =>
  Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));

export function errorInfo(e: unknown): { status: number; code: string; message: string } {
  if (e instanceof ApiError) return { status: e.status, code: e.code, message: e.message };
  return { status: 0, code: 'NETWORK', message: e instanceof Error ? e.message : String(e) };
}
