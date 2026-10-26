import { AuthService } from './auth.service';

describe('AuthService.checkPassword', () => {
  const password = 'mật khẩu đủ dài 20+ ký tự';
  const svc = new AuthService({
    appPassword: password,
    sessionSecret: 's'.repeat(32),
    cookieSecure: true,
  });

  it('accepts the right password, including another Unicode normalization form', () => {
    expect(svc.checkPassword(password)).toBe(true);
    expect(svc.checkPassword(password.normalize('NFD'))).toBe(true);
  });

  it('returns false (does not throw) for wrong passwords of any length', () => {
    for (const p of ['', 'x', password.slice(0, -1), `${password}x`, 'y'.repeat(1024)]) {
      expect(() => svc.checkPassword(p)).not.toThrow();
      expect(svc.checkPassword(p)).toBe(false);
    }
  });
});
