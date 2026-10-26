import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { uuidV4FromRandomValues } from './uuid';

describe('uuidV4FromRandomValues', () => {
  it('produces RFC 4122 v4 UUIDs accepted by the API schema (z.uuid)', () => {
    for (let i = 0; i < 50; i++) {
      const id = uuidV4FromRandomValues();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(z.uuid().safeParse(id).success).toBe(true);
    }
  });

  it('sets version/variant bits even when random bytes are all 0xff', () => {
    expect(uuidV4FromRandomValues((a) => a.fill(0xff))).toBe(
      'ffffffff-ffff-4fff-bfff-ffffffffffff',
    );
  });
});
