import { z } from 'zod';

/** Token DI cho cấu hình auth (override được trong test). */
export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export interface AuthConfig {
  appPassword: string;
  sessionSecret: string;
  cookieSecure: boolean;
}

const PLACEHOLDER_PREFIX = 'change-me';

const authEnvSchema = z
  .object({
    APP_PASSWORD: z
      .string({ error: 'APP_PASSWORD chưa được đặt' })
      .min(10, 'APP_PASSWORD phải từ 10 ký tự'),
    SESSION_SECRET: z
      .string({ error: 'SESSION_SECRET chưa được đặt' })
      .min(32, 'SESSION_SECRET phải từ 32 ký tự'),
    COOKIE_SECURE: z
      .enum(['true', 'false'], { error: 'COOKIE_SECURE phải là "true" hoặc "false"' })
      .default('true'),
  })
  .refine((e) => e.APP_PASSWORD !== e.SESSION_SECRET, {
    message: 'APP_PASSWORD và SESSION_SECRET phải khác nhau',
  })
  // Giá trị mẫu "change-me-at-least-10-chars" dài đủ 10 ký tự, nên min(10) không chặn được.
  .refine(
    (e) => ![e.APP_PASSWORD, e.SESSION_SECRET].some((v) => v.startsWith(PLACEHOLDER_PREFIX)),
    { message: 'APP_PASSWORD hoặc SESSION_SECRET vẫn là giá trị mẫu từ .env.example' },
  );

/**
 * Đọc và kiểm tra biến môi trường auth. Sai thì throw (app không khởi động).
 * Thông báo lỗi chỉ có tên biến và lý do, KHÔNG in giá trị.
 *
 * KHÔNG gọi trong data-source.ts: CLI migration (CI, container) không có APP_PASSWORD.
 */
export function parseAuthEnv(env: NodeJS.ProcessEnv): AuthConfig {
  const res = authEnvSchema.safeParse({
    APP_PASSWORD: env.APP_PASSWORD,
    SESSION_SECRET: env.SESSION_SECRET,
    // Biến rỗng ("COOKIE_SECURE=") coi như không đặt.
    COOKIE_SECURE: env.COOKIE_SECURE?.trim() || undefined,
  });
  if (!res.success) {
    const lines = res.error.issues.map((i) => `  - ${i.message}`);
    throw new Error(
      `Cấu hình auth không hợp lệ (đặt trong .env ở gốc repo, xem .env.example):\n${lines.join('\n')}`,
    );
  }
  return {
    appPassword: res.data.APP_PASSWORD,
    sessionSecret: res.data.SESSION_SECRET,
    cookieSecure: res.data.COOKIE_SECURE === 'true',
  };
}
