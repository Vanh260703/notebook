/** Số trang từ `?page=` trên URL: số nguyên ≥ 1, giá trị lạ thì về trang 1. */
export function parsePage(raw: string | null): number {
  return Math.max(1, Number.parseInt(raw ?? '1', 10) || 1);
}

/** Tổng số trang (tối thiểu 1, kể cả khi danh sách rỗng). */
export const pageCount = (total: number, pageSize: number): number =>
  Math.max(1, Math.ceil(total / pageSize));

/** Giá trị `page` đặt lên URL: trang 1 thì bỏ tham số. */
export const pageParam = (page: number): string | undefined =>
  page > 1 ? String(page) : undefined;
