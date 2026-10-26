import { z } from 'zod';
import { noteSchema } from './note';
import { tagSchema } from './tag';

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'INVALID_PASSWORD',
  'TOO_MANY_ATTEMPTS',
  'NOT_FOUND',
  'NOTE_NOT_FOUND',
  'NOTE_IN_TRASH',
  'NOTE_NOT_IN_TRASH',
  'VERSION_CONFLICT',
  'TAG_NOT_FOUND',
  'TAG_NAME_TAKEN',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'NOT_IMPLEMENTED',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const apiErrorSchema = z.object({
  statusCode: z.int(),
  // Để lỏng: client cũ không vỡ khi server thêm mã mới.
  code: z.string(),
  message: z.string(),
  /** path dạng "tags.0" */
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  /** Giây, đi kèm 429 (cũng có trong header Retry-After). */
  retryAfter: z.int().optional(),
});

export const versionConflictErrorSchema = apiErrorSchema.extend({
  code: z.literal('VERSION_CONFLICT'),
  current: noteSchema,
});
export const tagNameTakenErrorSchema = apiErrorSchema.extend({
  code: z.literal('TAG_NAME_TAKEN'),
  existing: tagSchema,
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
export type VersionConflictError = z.infer<typeof versionConflictErrorSchema>;
export type TagNameTakenError = z.infer<typeof tagNameTakenErrorSchema>;
