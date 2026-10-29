import { describe, expect, it } from 'vitest';
import { DAYS_RANGE_MAX, dayCountsQuerySchema, dayCountsResponseSchema } from './day';

describe('dayCountsQuerySchema', () => {
  it('accepts a valid range, including from = to', () => {
    expect(dayCountsQuerySchema.parse({ from: '2026-10-01', to: '2026-10-31' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(dayCountsQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-01' }).success).toBe(
      true,
    );
  });

  it('rejects from > to with the issue on "to"', () => {
    const r = dayCountsQuerySchema.safeParse({ from: '2026-11-01', to: '2026-10-01' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['to']);
  });

  it(`rejects ranges of ${DAYS_RANGE_MAX} days or more, accepts ${DAYS_RANGE_MAX - 1}`, () => {
    // 2026-01-01 + 399 ngày = 2027-02-04; + 400 = 2027-02-05
    expect(dayCountsQuerySchema.safeParse({ from: '2026-01-01', to: '2027-02-04' }).success).toBe(
      true,
    );
    expect(dayCountsQuerySchema.safeParse({ from: '2026-01-01', to: '2027-02-05' }).success).toBe(
      false,
    );
  });

  it('rejects impossible or malformed dates and missing params', () => {
    expect(dayCountsQuerySchema.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success).toBe(
      false,
    );
    expect(dayCountsQuerySchema.safeParse({ from: '2026-2-1', to: '2026-03-01' }).success).toBe(
      false,
    );
    expect(dayCountsQuerySchema.safeParse({ from: '2026-02-01' }).success).toBe(false);
  });
});

describe('dayCountsResponseSchema', () => {
  it('requires count >= 1', () => {
    expect(
      dayCountsResponseSchema.safeParse({ items: [{ date: '2026-10-27', count: 3 }] }).success,
    ).toBe(true);
    expect(
      dayCountsResponseSchema.safeParse({ items: [{ date: '2026-10-27', count: 0 }] }).success,
    ).toBe(false);
  });
});
