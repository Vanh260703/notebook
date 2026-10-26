import { LoginRateLimiter } from './login-rate-limiter';

describe('LoginRateLimiter', () => {
  const T0 = 1_000_000_000_000;
  const MIN = 60_000;

  it('allows up to 5 failures, then blocks with a positive retryAfter', () => {
    const l = new LoginRateLimiter();
    for (let i = 0; i < 4; i++) l.recordFailure(T0 + i * 1000);
    expect(l.retryAfterSeconds(T0 + 5000)).toBe(0);
    l.recordFailure(T0 + 4000);
    const retry = l.retryAfterSeconds(T0 + 5000);
    expect(retry).toBeGreaterThan(0);
    // Lần sai đầu tiên ở T0, cửa sổ 15 phút: còn 15 phút - 5 giây.
    expect(retry).toBe(15 * 60 - 5);
  });

  it('slides the window: old failures expire after 15 minutes', () => {
    const l = new LoginRateLimiter();
    for (let i = 0; i < 5; i++) l.recordFailure(T0 + i * MIN);
    expect(l.retryAfterSeconds(T0 + 14 * MIN)).toBeGreaterThan(0);
    // Lần sai đầu (T0) hết hạn lúc T0 + 15 phút, còn 4 lần: được thử lại.
    expect(l.retryAfterSeconds(T0 + 15 * MIN)).toBe(0);
  });

  it('reset() clears failures', () => {
    const l = new LoginRateLimiter();
    for (let i = 0; i < 5; i++) l.recordFailure(T0);
    expect(l.retryAfterSeconds(T0)).toBeGreaterThan(0);
    l.reset();
    expect(l.retryAfterSeconds(T0)).toBe(0);
  });
});
