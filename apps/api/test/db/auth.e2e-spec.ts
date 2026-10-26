import { apiErrorSchema, sessionSchema } from '@notebook/shared';
import request from 'supertest';
import { AUTH_CONFIG } from '../../src/common/config/auth-env';
import { TEST_PASSWORD, TEST_SESSION_SECRET } from './constants';
import { createTestApp, type TestContext } from './helpers';

const setCookieOf = (res: request.Response): string => {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith('nb_session=')) ?? '';
};

describe('Auth (e2e)', () => {
  let t: TestContext;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  it('401 UNAUTHORIZED without cookie; /health stays public', async () => {
    const res = await t.http().get('/notes').expect(401);
    expect(apiErrorSchema.parse(res.body).code).toBe('UNAUTHORIZED');
    await t.http().get('/tags').expect(401);
    await t.http().post('/notes').send({}).expect(401); // guard chạy trước validation
    await t.http().get('/health').expect(200);
  });

  it('401 with a forged or tampered cookie', async () => {
    await t.http().get('/notes').set('Cookie', 'nb_session=v1.123.abc').expect(401);
  });

  it('every API response has Cache-Control: no-store', async () => {
    const res = await t.http().get('/auth/me').expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('login sets a host-only, HttpOnly, Lax, Path=/ cookie valid for 365 days', async () => {
    const res = await t.http().post('/auth/login').send({ password: TEST_PASSWORD }).expect(200);
    const session = sessionSchema.parse(res.body);
    expect(session.authenticated).toBe(true);

    const cookie = setCookieOf(res);
    expect(cookie).toMatch(/^nb_session=v1\.\d+\.[\w-]+;/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/;');
    expect(cookie).toContain('Max-Age=31536000');
    expect(cookie).not.toMatch(/Domain=/i);
    expect(cookie).not.toContain('Secure'); // COOKIE_SECURE=false trong e2e

    // Agent dùng đúng cookie đó gọi được route cần đăng nhập.
    const agent = request.agent(t.app.getHttpServer());
    await agent.post('/auth/login').send({ password: TEST_PASSWORD }).expect(200);
    await agent.get('/notes').expect(200);
    const me = sessionSchema.parse((await agent.get('/auth/me').expect(200)).body);
    expect(me.authenticated).toBe(true);
    expect(me.expiresAt).toBe(session.expiresAt);
  });

  it('GET /auth/me is public and returns authenticated=false without cookie', async () => {
    const res = await t.http().get('/auth/me').expect(200);
    expect(sessionSchema.parse(res.body)).toEqual({ authenticated: false, expiresAt: null });
  });

  it('logout clears the cookie with the same Path', async () => {
    const res = await t.agent.post('/auth/logout').expect(204);
    const cookie = setCookieOf(res);
    expect(cookie).toMatch(/^nb_session=;/);
    expect(cookie).toContain('Path=/;');
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    await t.agent.get('/notes').expect(401);
  });

  it('400 VALIDATION_FAILED for missing/empty password or unknown keys', async () => {
    for (const body of [{}, { password: '' }, { password: 'x', extra: 1 }]) {
      const res = await t.http().post('/auth/login').send(body).expect(400);
      expect(apiErrorSchema.parse(res.body).code).toBe('VALIDATION_FAILED');
    }
  });

  it('5 wrong passwords are 401, the 6th is 429 with Retry-After; right password while locked is 429', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await t
        .http()
        .post('/auth/login')
        .send({ password: `wrong-${i}` })
        .expect(401);
      expect(res.body.code).toBe('INVALID_PASSWORD');
    }
    const locked = await t.http().post('/auth/login').send({ password: 'wrong-6' }).expect(429);
    const body = apiErrorSchema.parse(locked.body);
    expect(body.code).toBe('TOO_MANY_ATTEMPTS');
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(locked.headers['retry-after']).toBe(String(body.retryAfter));

    const right = await t.http().post('/auth/login').send({ password: TEST_PASSWORD }).expect(429);
    expect(right.headers['set-cookie']).toBeUndefined();
    // Thiết bị đã có cookie không bị ảnh hưởng.
    await t.agent.get('/notes').expect(200);
  });

  it('a successful login resets the failure counter', async () => {
    for (let i = 0; i < 4; i++) {
      await t.http().post('/auth/login').send({ password: 'wrong' }).expect(401);
    }
    await t.http().post('/auth/login').send({ password: TEST_PASSWORD }).expect(200);
    for (let i = 0; i < 5; i++) {
      await t.http().post('/auth/login').send({ password: 'wrong' }).expect(401);
    }
  });
});

describe('Auth cookie with COOKIE_SECURE=true (e2e)', () => {
  let t: TestContext;

  beforeAll(async () => {
    t = await createTestApp((b) =>
      b.overrideProvider(AUTH_CONFIG).useValue({
        appPassword: TEST_PASSWORD,
        sessionSecret: TEST_SESSION_SECRET,
        cookieSecure: true,
      }),
    );
  });
  afterAll(() => t.close());

  it('adds the Secure attribute even though the request is plain http', async () => {
    const res = await t.http().post('/auth/login').send({ password: TEST_PASSWORD }).expect(200);
    expect(setCookieOf(res)).toContain('; Secure');
  });
});
