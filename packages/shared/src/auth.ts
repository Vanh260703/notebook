import { z } from 'zod';

export const loginSchema = z.strictObject({ password: z.string().min(1).max(1024) });

/** GET /auth/me luôn trả 200 với dạng này (route public). */
export const sessionSchema = z.object({
  authenticated: z.boolean(),
  expiresAt: z.iso.datetime().nullable(),
});

export type LoginInput = z.input<typeof loginSchema>;
export type Session = z.infer<typeof sessionSchema>;
