import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { CookieOptions } from 'express';
import { AUTH_CONFIG, type AuthConfig } from '../../common/config/auth-env';

export const SESSION_COOKIE = 'nb_session';
export const SESSION_MAX_AGE_S = 365 * 24 * 3600;
const CLOCK_SKEW_S = 300;
const VERSION = 'v1';

/**
 * Cookie phiên: `v1.<iat giây>.<base64url(HMAC-SHA256(SESSION_SECRET, "v1.<iat>"))>`.
 * Không lưu gì phía server. Đổi SESSION_SECRET = đăng xuất mọi thiết bị.
 */
@Injectable()
export class SessionService {
  constructor(@Inject(AUTH_CONFIG) private readonly cfg: AuthConfig) {}

  private mac(payload: string): Buffer {
    return createHmac('sha256', this.cfg.sessionSecret).update(payload).digest();
  }

  issue(now = Date.now()): { value: string; expiresAt: string } {
    const iat = Math.floor(now / 1000);
    const payload = `${VERSION}.${iat}`;
    return {
      value: `${payload}.${this.mac(payload).toString('base64url')}`,
      expiresAt: this.expiresAt(iat),
    };
  }

  expiresAt(iat: number): string {
    return new Date((iat + SESSION_MAX_AGE_S) * 1000).toISOString();
  }

  /** Trả về iat (giây) nếu hợp lệ, null nếu không. Không bao giờ throw. */
  verify(value: string | undefined, now = Date.now()): number | null {
    if (!value) return null;
    const [ver, iatStr, sig, ...rest] = value.split('.');
    if (rest.length || ver !== VERSION || !iatStr || !/^\d{1,12}$/.test(iatStr) || !sig) {
      return null;
    }
    const expected = this.mac(`${ver}.${iatStr}`);
    const got = Buffer.from(sig, 'base64url');
    // Kiểm độ dài trước: timingSafeEqual throw khi hai buffer khác độ dài.
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
    const iat = Number(iatStr);
    const nowS = Math.floor(now / 1000);
    if (iat > nowS + CLOCK_SKEW_S || nowS - iat > SESSION_MAX_AGE_S) return null;
    return iat;
  }

  cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.cfg.cookieSecure,
      sameSite: 'lax',
      // Path tường minh: thiếu thì mặc định là /api/auth (trình duyệt gọi /api/auth/login),
      // cookie sẽ không được gửi kèm /api/notes.
      path: '/',
      // Express nhận maxAge tính bằng MILI GIÂY. KHÔNG đặt domain (cookie host-only).
      maxAge: SESSION_MAX_AGE_S * 1000,
    };
  }

  /** clearCookie phải dùng cùng path/secure/sameSite với lúc set. */
  clearOptions(): CookieOptions {
    const { maxAge: _, ...o } = this.cookieOptions();
    return o;
  }
}
