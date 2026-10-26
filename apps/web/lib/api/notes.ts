import type {
  CreateNoteInput,
  ListNotesQuery,
  Note,
  NoteListResponse,
  UpdateNoteInput,
} from '@notebook/shared';
import { apiFetch, toQueryString } from './client';

export const listNotes = (q: ListNotesQuery = {}) =>
  apiFetch<NoteListResponse>(
    `/notes${toQueryString({
      q: q.q,
      type: q.type,
      status: q.status,
      tag: q.tag,
      date: q.date,
      trashed: q.trashed === undefined ? undefined : String(q.trashed),
      page: q.page,
      limit: q.limit,
    })}`,
  );

export const getNote = (id: string) => apiFetch<Note>(`/notes/${id}`);

/** Idempotent theo id: gửi lại cùng id an toàn (201 lần đầu, 200 các lần sau). */
export const createNote = (input: CreateNoteInput) =>
  apiFetch<Note>('/notes', { method: 'POST', body: input });

export const updateNote = (id: string, input: UpdateNoteInput) =>
  apiFetch<Note>(`/notes/${id}`, { method: 'PATCH', body: input });

export const deleteNote = (id: string) => apiFetch<void>(`/notes/${id}`, { method: 'DELETE' });

export const restoreNote = (id: string) =>
  apiFetch<Note>(`/notes/${id}/restore`, { method: 'POST' });

export const deleteNotePermanently = (id: string) =>
  apiFetch<void>(`/notes/${id}/permanent`, { method: 'DELETE' });
