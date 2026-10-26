import type { RenameTagInput, TagListResponse, TagWithCount } from '@notebook/shared';
import { apiFetch } from './client';

export const listTags = () => apiFetch<TagListResponse>('/tags');

export const renameTag = (id: string, input: RenameTagInput) =>
  apiFetch<TagWithCount>(`/tags/${id}`, { method: 'PATCH', body: input });

export const deleteTag = (id: string) => apiFetch<void>(`/tags/${id}`, { method: 'DELETE' });
