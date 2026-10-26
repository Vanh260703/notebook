import { describe, expect, it } from 'vitest';
import { loginSchema, sessionSchema } from './auth';
import { renameTagSchema } from './tag';

describe('loginSchema', () => {
  it('requires a non-empty password and rejects unknown keys', () => {
    expect(loginSchema.safeParse({ password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ password: 'x', remember: true }).success).toBe(false);
  });
});

describe('sessionSchema', () => {
  it('accepts null expiresAt', () => {
    expect(sessionSchema.parse({ authenticated: false, expiresAt: null })).toEqual({
      authenticated: false,
      expiresAt: null,
    });
  });
});

describe('renameTagSchema', () => {
  it('normalizes name and defaults merge to false', () => {
    expect(renameTagSchema.parse({ name: ' Docker ' })).toEqual({ name: 'docker', merge: false });
  });
});
