import { NextResponse, type NextRequest } from 'next/server';

/** Phải trùng tên cookie trong apps/api/src/modules/auth/session.service.ts. */
const SESSION_COOKIE = 'nb_session';

/**
 * Kiểm tra LẠC QUAN: chỉ xem có cookie phiên hay không, không kiểm HMAC
 * (SESSION_SECRET không cần có trên Vercel). Kiểm tra thật nằm ở API; apiFetch gặp 401 thì về /login.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // BẮT BUỘC loại /api (nếu không chính POST /api/auth/login bị redirect), /_next, /login và file tĩnh.
  // /apple-icon không có đuôi file: iOS tải nó không kèm cookie, không loại thì nhận về trang login.
  matcher: ['/((?!api|_next|login|apple-icon|favicon.ico|.*\\..*).*)'],
};
