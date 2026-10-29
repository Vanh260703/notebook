import { z } from 'zod';
import { entryDateSchema } from './note';

/** Khoảng tối đa của GET /days (đủ cho heatmap 53 tuần ở GĐ4). */
export const DAYS_RANGE_MAX = 400;

/** Số thứ tự ngày (UTC) của 'YYYY-MM-DD', không qua giờ địa phương. */
const dayNumber = (ymd: string): number => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86_400_000;
};

/**
 * GET /days?from=&to= (cả hai đầu đều tính). So sánh chuỗi from <= to đúng vì entryDateSchema
 * bảo đảm dạng YYYY-MM-DD.
 */
export const dayCountsQuerySchema = z
  .object({ from: entryDateSchema, to: entryDateSchema })
  .refine((v) => v.from <= v.to, { message: 'from phải trước hoặc bằng to', path: ['to'] })
  .refine((v) => dayNumber(v.to) - dayNumber(v.from) < DAYS_RANGE_MAX, {
    message: `Khoảng tối đa ${DAYS_RANGE_MAX} ngày`,
    path: ['to'],
  });

export const dayCountSchema = z.object({ date: z.iso.date(), count: z.int().min(1) });
/** Chỉ những ngày có ít nhất 1 note (chưa xóa, gồm ARCHIVED), sắp theo ngày. */
export const dayCountsResponseSchema = z.object({ items: z.array(dayCountSchema) });

export type DayCountsQuery = z.input<typeof dayCountsQuerySchema>;
export type DayCount = z.infer<typeof dayCountSchema>;
export type DayCountsResponse = z.infer<typeof dayCountsResponseSchema>;
