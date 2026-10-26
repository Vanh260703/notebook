import { healthResponseSchema, type HealthResponse } from '@notebook/shared';

/** /health trả JSON cả khi 503 (db down) nên không đi qua apiFetch. */
export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health', { cache: 'no-store' });
  // Lỗi proxy (API tắt) thì không có JSON hợp lệ.
  const body: unknown = await res.json().catch(() => null);
  const parsed = healthResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`API không phản hồi (HTTP ${res.status})`);
  }
  return parsed.data;
}
