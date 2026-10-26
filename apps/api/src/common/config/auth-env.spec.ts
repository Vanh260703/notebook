import { parseAuthEnv } from './auth-env';

describe('parseAuthEnv', () => {
  const ok = {
    APP_PASSWORD: 'a-long-enough-password-123',
    SESSION_SECRET: '0123456789abcdef0123456789abcdef',
  };

  it('parses valid env, COOKIE_SECURE defaults to true', () => {
    expect(parseAuthEnv(ok)).toEqual({
      appPassword: ok.APP_PASSWORD,
      sessionSecret: ok.SESSION_SECRET,
      cookieSecure: true,
    });
    expect(parseAuthEnv({ ...ok, COOKIE_SECURE: 'false' }).cookieSecure).toBe(false);
    expect(parseAuthEnv({ ...ok, COOKIE_SECURE: '' }).cookieSecure).toBe(true);
  });

  it('accepts a password of exactly 10 characters', () => {
    expect(parseAuthEnv({ ...ok, APP_PASSWORD: '0123456789' }).appPassword).toBe('0123456789');
  });

  it.each([
    ['missing APP_PASSWORD', { SESSION_SECRET: ok.SESSION_SECRET }],
    ['missing SESSION_SECRET', { APP_PASSWORD: ok.APP_PASSWORD }],
    ['password under 10 chars', { ...ok, APP_PASSWORD: '123456789' }],
    ['secret under 32 chars', { ...ok, SESSION_SECRET: 'x'.repeat(31) }],
    ['placeholder password', { ...ok, APP_PASSWORD: 'change-me-at-least-10-chars' }],
    ['placeholder secret', { ...ok, SESSION_SECRET: 'change-me-openssl-rand-hex-32-xxxx' }],
    ['password equals secret', { APP_PASSWORD: 'x'.repeat(40), SESSION_SECRET: 'x'.repeat(40) }],
    ['invalid COOKIE_SECURE', { ...ok, COOKIE_SECURE: 'yes' }],
  ])('throws on %s', (_, env) => {
    expect(() => parseAuthEnv(env)).toThrow(/Cấu hình auth không hợp lệ/);
  });

  it('never includes the secret values in the error message', () => {
    const env = { APP_PASSWORD: 'change-me-at-least-10-chars', SESSION_SECRET: 'short' };
    try {
      parseAuthEnv(env);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error).message).not.toContain(env.APP_PASSWORD);
      expect((e as Error).message).not.toContain('short\n');
    }
  });
});
