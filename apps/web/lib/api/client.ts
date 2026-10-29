import { apiErrorSchema, type ApiErrorBody } from '@notebook/shared';

/** Lỗi từ API (hoặc từ mạng: status 0, code NETWORK). `body` giữ nguyên các field thêm như `current`, `existing`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody & Record<string, unknown>,
  ) {
    super(body.message);
    this.name = 'ApiError';
  }

  get code(): string {
    return this.body.code;
  }
}

export const isApiError = (e: unknown, code?: string): e is ApiError =>
  e instanceof ApiError && (code === undefined || e.code === code);

let redirecting = false;

/** Phiên hết hạn/không hợp lệ: tải lại trang login (xóa luôn cache TanStack Query trong bộ nhớ). */
function redirectToLogin(): void {
  if (typeof window === 'undefined' || redirecting) return;
  redirecting = true;
  const next = window.location.pathname + window.location.search;
  // Cố ý tải lại cả trang: xóa sạch state/cache trong bộ nhớ của phiên cũ.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

/**
 * Mọi request tới API đi qua đường dẫn tương đối /api/* (Next.js rewrite sang API_URL).
 * Không dùng URL tuyệt đối của API ở frontend.
 */
export interface ApiFetchInit {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  /**
   * Gặp 401 thì tải lại trang login (mặc định true). Outbox truyền false: một lần gửi chạy nền
   * không được chuyển trang giữa lúc người dùng đang gõ; nó tự báo "phiên đã hết hạn".
   */
  redirectOn401?: boolean;
}

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init?.method ?? 'GET',
      headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: init?.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, {
      statusCode: 0,
      code: 'NETWORK',
      message: 'Không kết nối được tới máy chủ',
    });
  }
  if (res.status === 204) return undefined as T;
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    const body = parsed.success
      ? (json as ApiErrorBody & Record<string, unknown>)
      : {
          statusCode: res.status,
          code: 'INTERNAL',
          message:
            res.status >= 500
              ? `Máy chủ không phản hồi (HTTP ${res.status})`
              : `HTTP ${res.status}`,
        };
    // INVALID_PASSWORD là 401 của chính form đăng nhập, không chuyển trang.
    if (res.status === 401 && body.code !== 'INVALID_PASSWORD' && init?.redirectOn401 !== false) {
      redirectToLogin();
    }
    throw new ApiError(res.status, body);
  }
  return json as T;
}

/** Bỏ các giá trị undefined/rỗng, trả về "?a=1&b=2" hoặc "". */
export function toQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Thông báo lỗi để hiển thị cho người dùng. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Đã có lỗi xảy ra';
}
