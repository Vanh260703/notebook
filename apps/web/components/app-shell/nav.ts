import type { ListNotesQuery, TagWithCount } from '@notebook/shared';

/**
 * Điều hướng chính, dùng chung cho sidebar (desktop) và tab bar (mobile). Logic thuần, có test.
 * Icon gắn ở component (file này không phụ thuộc React).
 */
export type NavKey = 'today' | 'inbox' | 'notes' | 'tags' | 'trash';

export type NavItem = { key: NavKey; href: string; label: string };

export const NAV: readonly NavItem[] = [
  // Ô "Tìm kiếm (Ctrl K)" nằm dưới nút Note mới trong sidebar, không phải một mục ở đây.
  { key: 'today', href: '/today', label: 'Hôm nay' },
  { key: 'inbox', href: '/inbox', label: 'Inbox' },
  { key: 'notes', href: '/notes', label: 'Ghi chú' },
  { key: 'tags', href: '/tags', label: 'Tag' },
  { key: 'trash', href: '/trash', label: 'Thùng rác' },
];

const under = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/**
 * Màn hình tập trung một việc (tab bar ẩn, main không chừa chỗ cho tab bar):
 * soạn note (`/notes/new`, `/notes/<id>`) và chế độ đọc (`/notes/<id>/read`).
 */
export const isFocusRoute = (pathname: string): boolean =>
  /^\/notes\/[^/]+$/.test(pathname) || /^\/notes\/(?!new\/)[^/]+\/read$/.test(pathname);

/**
 * Mục nav đang chọn.
 * - "Ghi chú": `/notes` không lọc theo tag (đang lọc tag thì tag đó trong sidebar sáng), hoặc
 *   `/notes/<id>`; không tính `/notes/new`.
 * `tag`: giá trị `?tag=` trên URL (tab bar truyền null vì mobile không có danh sách tag).
 */
export function isNavActive(key: NavKey, pathname: string, tag: string | null = null): boolean {
  switch (key) {
    case 'today':
      return under(pathname, '/today');
    case 'inbox':
      return under(pathname, '/inbox');
    case 'notes':
      return (
        (pathname === '/notes' && !tag) || (isFocusRoute(pathname) && pathname !== '/notes/new')
      );
    case 'tags':
      return under(pathname, '/tags');
    case 'trash':
      return under(pathname, '/trash');
  }
}

/** Tag đang chọn trong sidebar: chỉ ở trang danh sách `/notes?tag=<tên>`. */
export const isTagActive = (name: string, pathname: string, tag: string | null): boolean =>
  pathname === '/notes' && tag === name;

/** Số trên badge tab bar: tối đa "99+". */
export const formatBadgeCount = (n: number): string => (n > 99 ? '99+' : String(n));

export const SIDEBAR_TAG_LIMIT = 8;

/**
 * Tag hiện ở sidebar: bỏ tag không còn note nào (vẫn thấy ở trang Tag), sắp theo số note giảm dần
 * rồi theo tên, lấy tối đa `limit`. `hasMore`: còn tag không hiện (link "Xem tất cả").
 */
export function pickSidebarTags(
  tags: readonly TagWithCount[],
  limit = SIDEBAR_TAG_LIMIT,
): { items: TagWithCount[]; hasMore: boolean } {
  const items = tags
    .filter((t) => t.noteCount > 0)
    .sort((a, b) => b.noteCount - a.noteCount || a.name.localeCompare(b.name, 'vi'))
    .slice(0, limit);
  return { items, hasMore: tags.length > items.length };
}

/**
 * Query đếm cho sidebar/tab bar: GET /notes với limit=1, chỉ đọc `total` (không cần endpoint mới).
 * Key nằm dưới ['notes','list'] nên mọi mutation note (afterNoteSaved) tự làm mới số đếm.
 */
export const NAV_COUNT_QUERIES = {
  // Khớp danh sách Ghi chú mặc định: không tính note lưu trữ.
  notes: { excludeArchived: true, limit: 1 },
  inbox: { status: 'INBOX', limit: 1 },
  trash: { trashed: true, limit: 1 },
} as const satisfies Record<string, ListNotesQuery>;
