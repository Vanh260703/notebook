import type { Note as NoteDto, NoteListItem, Tag as TagDto } from '@notebook/shared';
import type { Note } from './note.entity';

/** So sánh theo code point: cùng một thứ tự ở mọi nơi, không phụ thuộc locale. */
export const byName = (a: { name: string }, b: { name: string }): number =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

export const toTagDtos = (tags: readonly { id: string; name: string }[]): TagDto[] =>
  tags.map(({ id, name }) => ({ id, name })).sort(byName);

/** Entity (có relation tags) sang Note của shared. Date thành chuỗi ISO. */
export function toNoteDto(n: Note): NoteDto {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    type: n.type,
    status: n.status,
    entryDate: n.entryDate,
    pinned: n.pinned,
    version: n.version,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    deletedAt: n.deletedAt ? n.deletedAt.toISOString() : null,
    tags: toTagDtos(n.tags ?? []),
  };
}

/** Một dòng raw của query danh sách (không có content, có excerpt). */
export interface NoteListRow {
  id: string;
  title: string;
  excerpt: string;
  type: Note['type'];
  status: Note['status'];
  entryDate: string;
  pinned: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export function toListItem(row: NoteListRow, tags: readonly TagDto[]): NoteListItem {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    type: row.type,
    status: row.status,
    entryDate: row.entryDate,
    pinned: row.pinned,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    tags: toTagDtos(tags),
  };
}
