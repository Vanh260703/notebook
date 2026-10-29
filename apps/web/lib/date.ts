import { TRASH_RETENTION_DAYS } from '@notebook/shared';
import { diffDays, parseYmd, weekdayName } from './calendar';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Ngày theo giờ ĐỊA PHƯƠNG dạng 'YYYY-MM-DD' (entryDate).
 * KHÔNG dùng toISOString().slice(0, 10): đó là ngày UTC, note viết trước 7h sáng (UTC+7) sẽ lệch sang hôm trước.
 */
export const localDate = (d = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** '2026-10-26' -> '26/10/2026' (không qua Date để không lệch múi giờ). */
export function formatEntryDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return y && m && d ? `${d}/${m}/${y}` : ymd;
}

/** ISO timestamp -> 'HH:mm' theo giờ địa phương. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Hôm nay: 'HH:mm'; ngày khác: 'HH:mm dd/MM/yyyy' (dòng "Đã lưu …" trong editor). */
export function formatSavedAt(iso: string, now: Date = new Date()): string {
  return localDate(new Date(iso)) === localDate(now) ? formatTime(iso) : formatDateTime(iso);
}

/** ISO timestamp -> 'HH:mm dd/MM/yyyy' theo giờ địa phương. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Số thứ tự ngày theo lịch địa phương (không bị lệch bởi giờ mùa hè). */
const dayNumber = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m, d) / 86_400_000);
const localDayNumber = (d: Date) => dayNumber(d.getFullYear(), d.getMonth(), d.getDate());
const ymdDayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return dayNumber(y!, m! - 1, d!);
};

/**
 * Thời điểm ISO -> chữ tương đối theo giờ địa phương:
 * < 1 phút "Vừa xong"; < 60 phút "N phút trước"; < 24 giờ "N giờ trước"; hôm qua "Hôm qua";
 * < 7 ngày "N ngày trước"; cùng năm "26/10"; khác năm "26/10/2025".
 * Thời điểm ở tương lai (lệch đồng hồ giữa máy và server) coi là "Vừa xong".
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const ms = now.getTime() - d.getTime();
  if (Number.isNaN(ms)) return '';
  if (ms < MINUTE) return 'Vừa xong';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} phút trước`;
  if (ms < 24 * HOUR) return `${Math.floor(ms / HOUR)} giờ trước`;
  const days = localDayNumber(now) - localDayNumber(d);
  if (days <= 1) return 'Hôm qua';
  if (days < 7) return `${days} ngày trước`;
  const dm = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  return d.getFullYear() === now.getFullYear() ? dm : `${dm}/${d.getFullYear()}`;
}

/** 'YYYY-MM-DD' -> "Hôm nay" | "Hôm qua" | "26/10" (cùng năm) | "26/10/2025". `today` cùng dạng. */
export function formatShortDay(ymd: string, today: string = localDate()): string {
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  const diff = ymdDayNumber(today) - ymdDayNumber(ymd);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  return y === today.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y}`;
}

/** Ngày của note (entryDate) khác ngày sửa (theo giờ địa phương): note viết lùi/tới ngày. */
export const isDifferentDay = (iso: string, ymd: string): boolean =>
  localDate(new Date(iso)) !== ymd;

/** "Đã xóa 2 giờ trước", "Đã xóa hôm qua", "Đã xóa 20/10" (danh sách thùng rác). */
export function formatDeleted(iso: string, now: Date = new Date()): string {
  const rel = formatRelative(iso, now);
  return `Đã xóa ${rel.charAt(0).toLowerCase()}${rel.slice(1)}`;
}

const DAY = 24 * HOUR;

/** Thời điểm note trong thùng rác bị API tự xóa vĩnh viễn (deletedAt + TRASH_RETENTION_DAYS). */
export const trashPurgeAt = (deletedAt: string): Date =>
  new Date(Date.parse(deletedAt) + TRASH_RETENTION_DAYS * DAY);

export interface TrashExpiry {
  /** "Còn 12 ngày" | "Còn 1 ngày" | "Còn dưới 1 ngày" | "Sắp bị xóa" (quá hạn, job chưa chạy). */
  text: string;
  /** Câu cho banner của note: "Sẽ tự xóa vĩnh viễn sau 12 ngày (26/11)." */
  sentence: string;
  /** Còn ≤ 3 ngày: hiện màu cảnh báo kèm icon. */
  urgent: boolean;
  purgeAt: Date;
}

/** Số ngày còn lại trước khi note trong thùng rác bị xóa vĩnh viễn (job dọn chạy mỗi giờ). */
export function formatTrashExpiry(deletedAt: string, now: Date = new Date()): TrashExpiry {
  const purgeAt = trashPurgeAt(deletedAt);
  const ms = purgeAt.getTime() - now.getTime();
  const when = `${pad(purgeAt.getDate())}/${pad(purgeAt.getMonth() + 1)}`;
  if (ms <= 0) {
    return {
      text: 'Sắp bị xóa',
      sentence: 'Đã quá hạn giữ, sẽ bị xóa vĩnh viễn trong giờ tới.',
      urgent: true,
      purgeAt,
    };
  }
  if (ms < DAY) {
    return {
      text: 'Còn dưới 1 ngày',
      sentence: `Sẽ tự xóa vĩnh viễn lúc ${formatTime(purgeAt.toISOString())} (${when}).`,
      urgent: true,
      purgeAt,
    };
  }
  const days = Math.ceil(ms / DAY);
  return {
    text: `Còn ${days} ngày`,
    sentence: `Sẽ tự xóa vĩnh viễn sau ${days} ngày (${when}).`,
    urgent: days <= 3,
    purgeAt,
  };
}

/** '2026-10-27' -> "Thứ Ba, 27 tháng 10, 2026" (không qua Intl để test ổn định). */
export function formatLongDay(ymd: string): string {
  const { y, m, d } = parseYmd(ymd);
  return `${weekdayName(ymd)}, ${d} tháng ${m}, ${y}`;
}

/**
 * Tiêu đề trang theo ngày: "Hôm nay" | "Hôm qua" | "Ngày mai" | tên thứ (trong 7 ngày gần đây)
 * | "26/10/2025".
 */
export function formatDayTitle(ymd: string, today: string): string {
  const diff = diffDays(ymd, today);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  if (diff === -1) return 'Ngày mai';
  if (diff > 1 && diff < 7) return weekdayName(ymd);
  return formatEntryDate(ymd);
}
