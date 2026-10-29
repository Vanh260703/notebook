import { z } from 'zod';
import { tagNameSchema, tagSchema } from './tag';

export const NOTE_TYPES = ['LEARNING', 'PERSONAL'] as const;
export const NOTE_STATUSES = ['INBOX', 'ACTIVE', 'ARCHIVED'] as const;

export type NoteType = (typeof NOTE_TYPES)[number];
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const noteTypeSchema = z.enum(NOTE_TYPES);
export const noteStatusSchema = z.enum(NOTE_STATUSES);

export const NOTE_DEFAULT_TYPE = 'LEARNING' satisfies NoteType;
/** Note mới (cả "Note mới" lẫn quick capture) vào Inbox, theo vòng đời ở PROJECT.md mục 3. */
export const NOTE_DEFAULT_STATUS = 'INBOX' satisfies NoteStatus;
export const NOTE_TITLE_MAX = 300;
/** Ký tự. Body limit của API là 1 MB (tiếng Việt tối đa ~3 byte/ký tự). */
export const NOTE_CONTENT_MAX = 200_000;
export const NOTE_TAGS_MAX = 20;
export const NOTE_EXCERPT_LENGTH = 300;
export const LIST_LIMIT_DEFAULT = 50;
export const LIST_LIMIT_MAX = 100;
export const LIST_PAGE_MAX = 10_000;
export const SEARCH_QUERY_MAX = 200;
/** Note trong thùng rác được giữ bấy nhiêu ngày (tính từ deletedAt) rồi API tự xóa vĩnh viễn. */
export const TRASH_RETENTION_DAYS = 30;

const titleSchema = z.string().trim().normalize('NFC').max(NOTE_TITLE_MAX);
// Không trim content: khoảng trắng có nghĩa trong Markdown.
const contentSchema = z.string().normalize('NFC').max(NOTE_CONTENT_MAX);
/** 'YYYY-MM-DD' theo giờ địa phương của client. Từ chối ngày không tồn tại (2026-02-30). */
export const entryDateSchema = z.iso.date();
const tagNamesSchema = z
  .array(tagNameSchema)
  .max(NOTE_TAGS_MAX)
  // Bỏ trùng SAU khi chuẩn hóa ("Docker" và "docker " là một).
  .transform((names) => [...new Set(names)]);

// ---- Request ----

export const createNoteSchema = z.strictObject({
  id: z.uuid(),
  entryDate: entryDateSchema,
  title: titleSchema.default(''),
  content: contentSchema.default(''),
  type: noteTypeSchema.default(NOTE_DEFAULT_TYPE),
  status: noteStatusSchema.default(NOTE_DEFAULT_STATUS),
  pinned: z.boolean().default(false),
  tags: tagNamesSchema.default([]),
});

export const updateNoteSchema = z
  .strictObject({
    version: z.int32().min(1),
    title: titleSchema.optional(),
    content: contentSchema.optional(),
    type: noteTypeSchema.optional(),
    status: noteStatusSchema.optional(),
    entryDate: entryDateSchema.optional(),
    pinned: z.boolean().optional(),
    /** Có thì THAY TOÀN BỘ danh sách tag của note. */
    tags: tagNamesSchema.optional(),
  })
  .refine(({ version: _, ...rest }) => Object.values(rest).some((v) => v !== undefined), {
    message: 'Cần ít nhất một trường để sửa',
  });

// Không strict: bỏ qua query lạ (cache-buster...).
export const listNotesQuerySchema = z.object({
  /** Tìm kiếm full-text (không dấu, prefix). Có q thì sắp theo độ khớp và item có `highlight`. */
  q: z
    .string()
    .trim()
    .normalize('NFC')
    .max(SEARCH_QUERY_MAX)
    .transform((v) => v || undefined)
    .optional(),
  type: noteTypeSchema.optional(),
  /** Không gửi = mọi status. */
  status: noteStatusSchema.optional(),
  tag: tagNameSchema.optional(),
  date: entryDateSchema.optional(),
  trashed: z.stringbool().default(false),
  /** Bỏ note ARCHIVED (danh sách Ghi chú mặc định). Không gửi = gồm cả ARCHIVED (như GĐ1). */
  excludeArchived: z.stringbool().default(false),
  page: z.coerce.number().int().min(1).max(LIST_PAGE_MAX).default(1),
  limit: z.coerce.number().int().min(1).max(LIST_LIMIT_MAX).default(LIST_LIMIT_DEFAULT),
});

// ---- Response ----

export const noteSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  content: z.string(),
  type: noteTypeSchema,
  status: noteStatusSchema,
  entryDate: z.iso.date(),
  pinned: z.boolean(),
  version: z.int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
  /** Sắp theo name. */
  tags: z.array(tagSchema),
});

/**
 * Đoạn khớp khi tìm kiếm. Chỗ khớp bọc bằng HIGHLIGHT_START/HIGHLIGHT_END (search.ts).
 * Client KHÔNG render như HTML: tách bằng splitHighlight rồi bọc <mark> bằng React.
 */
export const searchHighlightSchema = z.object({ title: z.string(), snippet: z.string() });

export const noteListItemSchema = noteSchema
  .omit({ content: true })
  // highlight chỉ có khi request có q.
  .extend({ excerpt: z.string(), highlight: searchHighlightSchema.optional() });

export const noteListResponseSchema = z.object({
  items: z.array(noteListItemSchema),
  page: z.int(),
  limit: z.int(),
  total: z.int(),
  hasMore: z.boolean(),
});

export type Note = z.infer<typeof noteSchema>;
export type NoteListItem = z.infer<typeof noteListItemSchema>;
export type SearchHighlight = z.infer<typeof searchHighlightSchema>;
export type NoteListResponse = z.infer<typeof noteListResponseSchema>;
/** Web dùng type input khi gửi request (chưa có default). */
export type CreateNoteInput = z.input<typeof createNoteSchema>;
export type UpdateNoteInput = z.input<typeof updateNoteSchema>;
/**
 * Query web gửi cho GET /notes. Không dùng thẳng z.input: với z.coerce.number() và z.stringbool()
 * kiểu input là unknown/string, nên page/limit/trashed ghi rõ kiểu ở đây (client tự đổi sang chuỗi).
 */
export type ListNotesQuery = Omit<
  z.input<typeof listNotesQuerySchema>,
  'page' | 'limit' | 'trashed' | 'excludeArchived'
> & { page?: number; limit?: number; trashed?: boolean; excludeArchived?: boolean };
/** Output: giá trị API nhận được sau khi validate (đã có default, đã chuẩn hóa). */
export type CreateNoteData = z.output<typeof createNoteSchema>;
export type UpdateNoteData = z.output<typeof updateNoteSchema>;
export type ListNotesParams = z.output<typeof listNotesQuerySchema>;
