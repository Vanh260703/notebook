import { entryDateSchema } from '@notebook/shared';

/**
 * Lịch theo ngày 'YYYY-MM-DD' (entryDate). Mọi phép tính qua Date.UTC + getUTC*, không qua giờ
 * địa phương: kết quả không phụ thuộc múi giờ hay giờ mùa hè. Tuần bắt đầu từ Thứ Hai.
 */
const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

export const WEEKDAY_NAMES = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
] as const;
export const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;
/** Tiêu đề cột của lưới (Thứ Hai trước). */
export const WEEK_HEADER = [1, 2, 3, 4, 5, 6, 0].map((i) => ({
  short: WEEKDAY_SHORT[i]!,
  long: WEEKDAY_NAMES[i]!,
}));

export const isValidYmd = (s: string | null | undefined): s is string =>
  typeof s === 'string' && entryDateSchema.safeParse(s).success;

export function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

const toUtc = (ymd: string) => {
  const { y, m, d } = parseYmd(ymd);
  return Date.UTC(y, m - 1, d);
};

const fromUtc = (ms: number) => {
  const t = new Date(ms);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

export const toYmd = (y: number, m: number, d: number): string => fromUtc(Date.UTC(y, m - 1, d));

export const addDays = (ymd: string, n: number): string => fromUtc(toUtc(ymd) + n * DAY_MS);

/** Số ngày từ a tới b (b - a). */
export const diffDays = (a: string, b: string): number =>
  Math.round((toUtc(b) - toUtc(a)) / DAY_MS);

/** 0 = Chủ Nhật … 6 = Thứ Bảy. */
export const weekday = (ymd: string): number => new Date(toUtc(ymd)).getUTCDay();

export const weekdayName = (ymd: string): string => WEEKDAY_NAMES[weekday(ymd)]!;

/** Thứ Hai của tuần chứa ngày này. */
export const startOfWeek = (ymd: string): string => addDays(ymd, -((weekday(ymd) + 6) % 7));

export const weekDays = (ymd: string): string[] => {
  const start = startOfWeek(ymd);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export interface YearMonth {
  y: number;
  /** 1–12 */
  m: number;
}

export const monthOf = (ymd: string): YearMonth => {
  const { y, m } = parseYmd(ymd);
  return { y, m };
};

export const addMonths = ({ y, m }: YearMonth, n: number): YearMonth => {
  const idx = y * 12 + (m - 1) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
};

/** Lưới 6×7 = 42 ngày, bắt đầu từ Thứ Hai trên hoặc trước ngày 1 của tháng. */
export function monthGrid({ y, m }: YearMonth): string[] {
  const start = startOfWeek(toYmd(y, m, 1));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const monthLabel = ({ y, m }: YearMonth): string => `Tháng ${m}, ${y}`;

export const sameMonth = (ymd: string, ym: YearMonth): boolean => {
  const { y, m } = parseYmd(ymd);
  return y === ym.y && m === ym.m;
};
