import { describe, expect, it } from 'vitest';
import {
  WEEK_HEADER,
  addDays,
  addMonths,
  diffDays,
  isValidYmd,
  monthGrid,
  monthLabel,
  startOfWeek,
  weekDays,
  weekdayName,
} from './calendar';

describe('monthGrid', () => {
  it('has 42 days starting on a Monday', () => {
    const g = monthGrid({ y: 2026, m: 10 }); // 1/10/2026 là Thứ Năm
    expect(g).toHaveLength(42);
    expect(g[0]).toBe('2026-09-28');
    expect(weekdayName(g[0]!)).toBe('Thứ Hai');
    expect(g[41]).toBe('2026-11-08');
  });

  it('a month that starts on a Monday begins with its 1st', () => {
    const g = monthGrid({ y: 2026, m: 6 }); // 1/6/2026 là Thứ Hai
    expect(g[0]).toBe('2026-06-01');
  });

  it('February of a leap year and December into the next year', () => {
    const feb = monthGrid({ y: 2028, m: 2 }); // 1/2/2028 là Thứ Ba
    expect(feb[0]).toBe('2028-01-31');
    expect(feb).toContain('2028-02-29');
    expect(feb.indexOf('2028-03-01')).toBe(feb.indexOf('2028-02-29') + 1);
    const dec = monthGrid({ y: 2026, m: 12 });
    expect(dec[0]).toBe('2026-11-30');
    expect(dec[41]).toBe('2027-01-10');
  });
});

describe('day arithmetic', () => {
  it('addDays across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-28', 7)).toBe('2026-04-04'); // qua mốc đổi giờ mùa hè ở nơi khác
    expect(diffDays('2026-10-27', '2026-11-03')).toBe(7);
  });

  it('addMonths', () => {
    expect(addMonths({ y: 2026, m: 12 }, 1)).toEqual({ y: 2027, m: 1 });
    expect(addMonths({ y: 2026, m: 1 }, -1)).toEqual({ y: 2025, m: 12 });
    expect(monthLabel({ y: 2026, m: 10 })).toBe('Tháng 10, 2026');
  });

  it('weekday names and Monday-based weeks', () => {
    expect(weekdayName('2026-10-27')).toBe('Thứ Ba');
    expect(weekdayName('2026-11-01')).toBe('Chủ Nhật');
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26');
    expect(startOfWeek('2026-10-26')).toBe('2026-10-26');
    expect(weekDays('2026-10-27')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(WEEK_HEADER.map((h) => h.short)).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
  });

  it('isValidYmd', () => {
    expect(isValidYmd('2026-10-27')).toBe(true);
    expect(isValidYmd('2026-02-30')).toBe(false);
    expect(isValidYmd('hôm nay')).toBe(false);
    expect(isValidYmd(null)).toBe(false);
  });
});
