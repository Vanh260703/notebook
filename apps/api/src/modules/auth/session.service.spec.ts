import type { AuthConfig } from '../../common/config/auth-env';
import { SESSION_MAX_AGE_S, SessionService } from './session.service';

const cfg = (over: Partial<AuthConfig> = {}): AuthConfig => ({
  appPassword: 'p'.repeat(20),
  sessionSecret: 's'.repeat(32),
  cookieSecure: true,
  ...over,
});

describe('SessionService', () => {
  const NOW = Date.UTC(2026, 9, 26, 1, 2, 3);
  const svc = new SessionService(cfg());

  it('issues a value that verifies to its iat', () => {
    const { value, expiresAt } = svc.issue(NOW);
    expect(value).toMatch(/^v1\.\d+\.[A-Za-z0-9_-]+$/);
    expect(svc.verify(value, NOW)).toBe(Math.floor(NOW / 1000));
    expect(expiresAt).toBe(new Date(NOW - (NOW % 1000) + SESSION_MAX_AGE_S * 1000).toISOString());
  });

  it('returns null (never throws) for tampered or malformed values', () => {
    const { value } = svc.issue(NOW);
    const [ver, iat, sig] = value.split('.');
    const flip = (c: string) => (c === 'A' ? 'B' : 'A');
    const cases = [
      undefined,
      '',
      `${ver}.${iat}.${sig.slice(0, -1)}${flip(sig.slice(-1))}`, // sai một ký tự chữ ký
      `${ver}.${iat}.${flip(sig[0])}${sig.slice(1)}`,
      `v2.${iat}.${sig}`, // sai tiền tố
      `${ver}.${iat}`, // thiếu phần
      `${ver}.${iat}.${sig}.extra`, // thừa phần
      `${ver}.${iat}.${sig}AAAA`, // chữ ký dài hơn
      `${ver}.${iat}.${sig.slice(0, 10)}`, // chữ ký ngắn hơn
      `${ver}.${Number(iat) + 1}.${sig}`, // đổi iat
      `${ver}.-1.${sig}`,
      `${ver}.1e9.${sig}`,
      `${ver}.${iat}.!!!`,
      'garbage',
    ];
    for (const c of cases) {
      expect(() => svc.verify(c, NOW)).not.toThrow();
      expect(svc.verify(c, NOW)).toBeNull();
    }
  });

  it('rejects sessions older than 365 days', () => {
    const { value } = svc.issue(NOW);
    expect(svc.verify(value, NOW + SESSION_MAX_AGE_S * 1000)).not.toBeNull();
    expect(svc.verify(value, NOW + (SESSION_MAX_AGE_S + 1) * 1000)).toBeNull();
  });

  it('rejects iat more than 5 minutes in the future', () => {
    expect(svc.verify(svc.issue(NOW + 299_000).value, NOW)).not.toBeNull();
    expect(svc.verify(svc.issue(NOW + 301_000).value, NOW)).toBeNull();
  });

  it('rejects values signed with another secret', () => {
    const other = new SessionService(cfg({ sessionSecret: 'x'.repeat(32) }));
    expect(svc.verify(other.issue(NOW).value, NOW)).toBeNull();
  });

  it('cookieOptions: Path=/, SameSite=Lax, HttpOnly, maxAge in ms, no domain', () => {
    const o = svc.cookieOptions();
    expect(o).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 24 * 3600 * 1000,
    });
    expect(o).not.toHaveProperty('domain');
    expect(new SessionService(cfg({ cookieSecure: false })).cookieOptions().secure).toBe(false);
  });

  it('clearOptions keeps path/secure/sameSite but drops maxAge', () => {
    expect(svc.clearOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  });
});
