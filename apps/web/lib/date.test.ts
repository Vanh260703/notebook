import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  formatDeleted,
  formatEntryDate,
  formatRelative,
  formatSavedAt,
  formatShortDay,
  formatTime,
  isDifferentDay,
  localDate,
} from './date';

const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Asia/Ho_Chi_Minh'; // UTC+7, Node đổi múi giờ ngay khi gán TZ
});
afterAll(() => {
  process.env.TZ = originalTz;
});

describe('localDate', () => {
  it('uses the local date, not the UTC date (06:00 in Vietnam is still the previous day in UTC)', () => {
    const sixAm = new Date('2026-10-25T23:00:00Z'); // 06:00 ngày 26/10 giờ Việt Nam
    expect(sixAm.toISOString().slice(0, 10)).toBe('2026-10-25');
    expect(localDate(sixAm)).toBe('2026-10-26');
  });

  it('pads month and day', () => {
    expect(localDate(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

describe('formatEntryDate', () => {
  it('formats YYYY-MM-DD as dd/MM/yyyy', () => {
    expect(formatEntryDate('2026-10-26')).toBe('26/10/2026');
  });
});

describe('formatRelative', () => {
  // 10:00 ngày 27/10/2026 giờ Việt Nam
  const now = new Date('2026-10-27T03:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;

  it('says "Vừa xong" under a minute, and for timestamps slightly in the future (clock skew)', () => {
    expect(formatRelative(ago(0), now)).toBe('Vừa xong');
    expect(formatRelative(ago(59_000), now)).toBe('Vừa xong');
    expect(formatRelative(ago(-30_000), now)).toBe('Vừa xong');
  });

  it('counts minutes, then hours', () => {
    expect(formatRelative(ago(MIN), now)).toBe('1 phút trước');
    expect(formatRelative(ago(59 * MIN + 59_000), now)).toBe('59 phút trước');
    expect(formatRelative(ago(HOUR), now)).toBe('1 giờ trước');
    expect(formatRelative(ago(23 * HOUR + 59 * MIN), now)).toBe('23 giờ trước');
  });

  it('uses local calendar days after 24 hours', () => {
    // 26/10 09:00 giờ VN (25 giờ trước) là hôm qua
    expect(formatRelative(ago(25 * HOUR), now)).toBe('Hôm qua');
    // 25/10 23:00 giờ VN: 35 giờ trước nhưng là 2 ngày lịch
    expect(formatRelative('2026-10-25T16:00:00Z', now)).toBe('2 ngày trước');
    expect(formatRelative('2026-10-21T03:00:00Z', now)).toBe('6 ngày trước');
  });

  it('uses the local date, not the UTC date, when counting days', () => {
    // 26/10 06:30 giờ VN = 25/10 23:30 UTC: vẫn là "Hôm qua" theo giờ địa phương
    expect(formatRelative('2026-10-25T23:30:00Z', now)).toBe('Hôm qua');
  });

  it('shows dd/MM from 7 days, and dd/MM/yyyy for another year', () => {
    expect(formatRelative('2026-10-20T03:00:00Z', now)).toBe('20/10');
    expect(formatRelative('2026-01-05T03:00:00Z', now)).toBe('05/01');
    expect(formatRelative('2025-10-26T03:00:00Z', now)).toBe('26/10/2025');
  });

  it('returns an empty string for an invalid timestamp', () => {
    expect(formatRelative('not a date', now)).toBe('');
  });
});

describe('formatShortDay', () => {
  it('names today and yesterday', () => {
    expect(formatShortDay('2026-10-27', '2026-10-27')).toBe('Hôm nay');
    expect(formatShortDay('2026-10-26', '2026-10-27')).toBe('Hôm qua');
  });

  it('handles month and year boundaries', () => {
    expect(formatShortDay('2026-09-30', '2026-10-01')).toBe('Hôm qua');
    expect(formatShortDay('2025-12-31', '2026-01-01')).toBe('Hôm qua');
  });

  it('shows dd/MM in the same year, dd/MM/yyyy otherwise (also for future dates)', () => {
    expect(formatShortDay('2026-10-20', '2026-10-27')).toBe('20/10');
    expect(formatShortDay('2026-10-28', '2026-10-27')).toBe('28/10');
    expect(formatShortDay('2025-10-26', '2026-10-27')).toBe('26/10/2025');
  });
});

describe('isDifferentDay', () => {
  it('compares the local day of a timestamp with an entry date', () => {
    expect(isDifferentDay('2026-10-25T23:30:00Z', '2026-10-26')).toBe(false); // 06:30 26/10 giờ VN
    expect(isDifferentDay('2026-10-25T16:00:00Z', '2026-10-26')).toBe(true); // 23:00 25/10 giờ VN
  });
});

describe('formatDeleted', () => {
  const now = new Date('2026-10-27T03:00:00Z');
  it('prefixes the relative time with "Đã xóa" in lower case', () => {
    expect(formatDeleted('2026-10-27T02:59:30Z', now)).toBe('Đã xóa vừa xong');
    expect(formatDeleted('2026-10-27T01:00:00Z', now)).toBe('Đã xóa 2 giờ trước');
    expect(formatDeleted('2026-10-26T01:00:00Z', now)).toBe('Đã xóa hôm qua');
    expect(formatDeleted('2026-10-01T03:00:00Z', now)).toBe('Đã xóa 01/10');
  });
});

describe('formatTime / formatSavedAt', () => {
  const now = new Date('2026-10-27T03:00:00Z'); // 10:00 27/10 giờ VN
  it('formats local hours and minutes', () => {
    expect(formatTime('2026-10-27T01:05:00Z')).toBe('08:05');
  });

  it('shows only the time for today, the full date otherwise', () => {
    expect(formatSavedAt('2026-10-27T01:05:00Z', now)).toBe('08:05');
    expect(formatSavedAt('2026-10-26T16:59:00Z', now)).toBe('23:59 26/10/2026');
  });
});
