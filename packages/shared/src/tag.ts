import { z } from 'zod';

export const TAG_NAME_MAX_LENGTH = 64;

/**
 * Tên tag được chuẩn hóa: bỏ khoảng trắng hai đầu, NFC (để "ệ" gõ kiểu tổ hợp
 * và kiểu dựng sẵn là một), chữ thường. Kiểm tra độ dài sau khi chuẩn hóa.
 */
export const tagNameSchema = z
  .string()
  .trim()
  .normalize('NFC')
  .toLowerCase()
  .pipe(z.string().min(1).max(TAG_NAME_MAX_LENGTH));

export type TagName = z.infer<typeof tagNameSchema>;

export const tagSchema = z.object({ id: z.uuid(), name: z.string() });
export const tagWithCountSchema = tagSchema.extend({ noteCount: z.int() });
export const tagListResponseSchema = z.object({ items: z.array(tagWithCountSchema) });

/** Đổi tên tag. Trùng tag khác thì 409, gửi lại với merge: true để gộp. */
export const renameTagSchema = z.strictObject({
  name: tagNameSchema,
  merge: z.boolean().default(false),
});

export type Tag = z.infer<typeof tagSchema>;
export type TagWithCount = z.infer<typeof tagWithCountSchema>;
export type TagListResponse = z.infer<typeof tagListResponseSchema>;
export type RenameTagInput = z.input<typeof renameTagSchema>;
