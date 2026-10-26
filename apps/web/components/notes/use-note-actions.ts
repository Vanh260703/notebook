'use client';

import type { Note, NoteListItem, NoteListResponse } from '@notebook/shared';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { errorMessage, isApiError } from '@/lib/api/client';
import { deleteNote, deleteNotePermanently, restoreNote, updateNote } from '@/lib/api/notes';
import { qk } from '@/lib/query-keys';

/** Sau mỗi mutation: cache chi tiết = response, danh sách và tag tải lại. */
export function afterNoteSaved(qc: QueryClient, note: Note | null): void {
  if (note) qc.setQueryData(qk.note(note.id), note);
  void qc.invalidateQueries({ queryKey: qk.noteLists });
  void qc.invalidateQueries({ queryKey: qk.tags });
}

type ListSnapshot = [readonly unknown[], NoteListResponse | undefined][];

async function patchLists(
  qc: QueryClient,
  fn: (items: NoteListItem[]) => NoteListItem[],
): Promise<ListSnapshot> {
  await qc.cancelQueries({ queryKey: qk.noteLists });
  const snapshot = qc.getQueriesData<NoteListResponse>({ queryKey: qk.noteLists });
  qc.setQueriesData<NoteListResponse>({ queryKey: qk.noteLists }, (old) => {
    if (!old) return old;
    const items = fn(old.items);
    return { ...old, items, total: old.total - (old.items.length - items.length) };
  });
  return snapshot;
}

const rollback = (qc: QueryClient, snapshot: ListSnapshot | undefined) =>
  snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));

/**
 * Khôi phục từ thùng rác. Bỏ khỏi danh sách thùng rác ngay (optimistic); note chưa có trong các
 * danh sách khác nên phần lọc đó không ảnh hưởng chúng. Danh sách tải lại sau khi xong.
 */
export function useRestoreNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreNote(id),
    onMutate: async (id) => ({
      snapshot: await patchLists(qc, (items) => items.filter((i) => i.id !== id)),
    }),
    onSuccess: (note) => {
      afterNoteSaved(qc, note);
      toast.success('Đã khôi phục note');
    },
    onError: (e, _id, ctx) => {
      rollback(qc, ctx?.snapshot);
      void qc.invalidateQueries({ queryKey: qk.noteLists });
      toast.error(errorMessage(e));
    },
  });
}

/** Xóa vĩnh viễn một note trong thùng rác (optimistic). Không có Hoàn tác. */
export function useDeleteNotePermanently() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNotePermanently(id),
    onMutate: async (id) => ({
      snapshot: await patchLists(qc, (items) => items.filter((i) => i.id !== id)),
    }),
    onError: (e, _id, ctx) => {
      rollback(qc, ctx?.snapshot);
      toast.error(errorMessage(e));
    },
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: qk.note(id) });
      toast.success('Đã xóa vĩnh viễn');
    },
    onSettled: () => afterNoteSaved(qc, null),
  });
}

/** Xóa mềm: bỏ khỏi danh sách ngay (optimistic), toast có nút Hoàn tác (restore). */
export function useDeleteNote(options?: { onDeleted?: (id: string) => void }) {
  const qc = useQueryClient();
  const restore = useRestoreNote();
  return useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onMutate: async (id) => ({
      snapshot: await patchLists(qc, (items) => items.filter((i) => i.id !== id)),
    }),
    onError: (e, _id, ctx) => {
      rollback(qc, ctx?.snapshot);
      toast.error(errorMessage(e));
    },
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: qk.note(id) });
      options?.onDeleted?.(id);
      toast('Đã chuyển vào thùng rác', {
        action: { label: 'Hoàn tác', onClick: () => restore.mutate(id) },
        duration: 8000,
      });
    },
    onSettled: () => afterNoteSaved(qc, null),
  });
}

/** Bật/tắt ghim trong danh sách (optimistic). 409 thì rollback, tải lại, báo toast. */
export function useTogglePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: NoteListItem) =>
      updateNote(item.id, { version: item.version, pinned: !item.pinned }),
    onMutate: async (item) => ({
      snapshot: await patchLists(qc, (items) =>
        items.map((i) => (i.id === item.id ? { ...i, pinned: !i.pinned } : i)),
      ),
    }),
    onError: (e, _item, ctx) => {
      rollback(qc, ctx?.snapshot);
      toast.error(
        isApiError(e, 'VERSION_CONFLICT')
          ? 'Note đã được sửa ở nơi khác, đã tải lại danh sách'
          : errorMessage(e),
      );
    },
    onSuccess: (note) => {
      // Cập nhật version ngay để lần bấm tiếp theo không bị 409 trước khi danh sách tải lại.
      qc.setQueriesData<NoteListResponse>(
        { queryKey: qk.noteLists },
        (old) =>
          old && {
            ...old,
            items: old.items.map((i) =>
              i.id === note.id ? { ...i, pinned: note.pinned, version: note.version } : i,
            ),
          },
      );
      qc.setQueryData(qk.note(note.id), note);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.noteLists }),
  });
}
