import type {
  CreateNoteInput,
  ListNotesQuery,
  Note,
  NoteListResponse,
  UpdateNoteInput,
} from '@notebook/shared';
import { apiFetch, toQueryString, type ApiFetchInit } from './client';

type Opts = Pick<ApiFetchInit, 'redirectOn401' | 'signal'>;

/** `signal`: TanStack Query truyền sẵn, request cũ bị hủy khi query key đổi (gõ tiếp ô tìm). */
export const listNotes = (q: ListNotesQuery = {}, signal?: AbortSignal) =>
  apiFetch<NoteListResponse>(
    `/notes${toQueryString({
      q: q.q,
      type: q.type,
      status: q.status,
      tag: q.tag,
      date: q.date,
      trashed: q.trashed === undefined ? undefined : String(q.trashed),
      excludeArchived: q.excludeArchived ? 'true' : undefined,
      page: q.page,
      limit: q.limit,
    })}`,
    { signal },
  );

export const getNote = (id: string) => apiFetch<Note>(`/notes/${id}`);

/** Idempotent theo id: gửi lại cùng id an toàn (201 lần đầu, 200 các lần sau). */
export const createNote = (input: CreateNoteInput, opts?: Opts) =>
  apiFetch<Note>('/notes', { method: 'POST', body: input, ...opts });

export const updateNote = (id: string, input: UpdateNoteInput, opts?: Opts) =>
  apiFetch<Note>(`/notes/${id}`, { method: 'PATCH', body: input, ...opts });

export const deleteNote = (id: string) => apiFetch<void>(`/notes/${id}`, { method: 'DELETE' });

export const restoreNote = (id: string) =>
  apiFetch<Note>(`/notes/${id}/restore`, { method: 'POST' });

export const deleteNotePermanently = (id: string) =>
  apiFetch<void>(`/notes/${id}/permanent`, { method: 'DELETE' });
