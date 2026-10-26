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
