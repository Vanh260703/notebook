'use client';

import {
  TRASH_RETENTION_DAYS,
  type Note,
  type NoteListItem,
  type NoteListResponse,
} from '@notebook/shared';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { errorMessage, isApiError } from '@/lib/api/client';
import { deleteNote, deleteNotePermanently, restoreNote, updateNote } from '@/lib/api/notes';
import { STATUS_LABEL } from '@/lib/labels';
import { qk } from '@/lib/query-keys';

/** Sau mỗi mutation: cache chi tiết = response; danh sách, tag và số note theo ngày tải lại. */
export function afterNoteSaved(qc: QueryClient, note: Note | null): void {
  if (note) qc.setQueryData(qk.note(note.id), note);
  void qc.invalidateQueries({ queryKey: qk.noteLists });
  void qc.invalidateQueries({ queryKey: qk.tags });
  void qc.invalidateQueries({ queryKey: qk.days });
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
      toast(`Đã chuyển vào thùng rác (giữ ${TRASH_RETENTION_DAYS} ngày)`, {
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

/** Trường sửa được từ Inbox (nút "Đang dùng" và dialog "Sắp xếp"). */
export interface NoteFields {
  type?: NoteListItem['type'];
  status?: NoteListItem['status'];
  /** Thay toàn bộ danh sách tag. */
  tags?: string[];
}

/** Danh sách có key lọc status INBOX (trang Inbox, số đếm Inbox). */
const isInboxList = (key: readonly unknown[]) => {
  const q = key[2] as { status?: string } | undefined;
  return q?.status === 'INBOX';
};

/**
 * PATCH vài trường của một note từ danh sách (xử lý Inbox). Optimistic:
 * - Rời Inbox (status khác INBOX): bỏ note khỏi các danh sách lọc INBOX ngay; danh sách khác tự
 *   tải lại nhờ afterNoteSaved.
 * - Đổi loại: cập nhật ngay trong mọi danh sách. Tag: chờ server (cần id tag).
 * Toast có Hoàn tác (PATCH lại các giá trị cũ bằng version mới). 409: rollback, tải lại, báo.
 */
export function useUpdateNoteFields() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ item, fields }: { item: NoteListItem; fields: NoteFields; undo?: boolean }) =>
      updateNote(item.id, { version: item.version, ...fields }),
    onMutate: async ({ item, fields }) => {
      await qc.cancelQueries({ queryKey: qk.noteLists });
      const snapshot = qc.getQueriesData<NoteListResponse>({ queryKey: qk.noteLists });
      const leaving = fields.status !== undefined && fields.status !== 'INBOX';
      if (leaving) {
        qc.setQueriesData<NoteListResponse>(
          { queryKey: qk.noteLists, predicate: (q) => isInboxList(q.queryKey) },
          (old) => {
            if (!old) return old;
            const items = old.items.filter((i) => i.id !== item.id);
            return { ...old, items, total: old.total - (old.items.length - items.length) };
          },
        );
      }
      qc.setQueriesData<NoteListResponse>(
        { queryKey: qk.noteLists },
        (old) =>
          old && {
            ...old,
            items: old.items.map((i) =>
              i.id === item.id
                ? { ...i, type: fields.type ?? i.type, status: fields.status ?? i.status }
                : i,
            ),
          },
      );
      return { snapshot };
    },
    onError: (e, _vars, ctx) => {
      rollback(qc, ctx?.snapshot);
      void qc.invalidateQueries({ queryKey: qk.noteLists });
      toast.error(
        isApiError(e, 'VERSION_CONFLICT')
          ? 'Note đã được sửa ở nơi khác, đã tải lại'
          : errorMessage(e),
      );
    },
    onSuccess: (note, { item, fields, undo }) => {
      afterNoteSaved(qc, note);
      if (undo) {
        toast.success('Đã hoàn tác');
        return;
      }
      // Hoàn tác: các trường vừa đổi về giá trị cũ, dựa trên version mới nhất.
      const previous: NoteFields = {};
      if (fields.type !== undefined) previous.type = item.type;
      if (fields.status !== undefined) previous.status = item.status;
      if (fields.tags !== undefined) previous.tags = item.tags.map((t) => t.name);
      const message =
        fields.status && fields.status !== item.status
          ? `Đã chuyển sang ${STATUS_LABEL[fields.status]}`
          : 'Đã cập nhật note';
      toast.success(message, {
        action: {
          label: 'Hoàn tác',
          onClick: () =>
            mutation.mutate({
              item: { ...item, version: note.version },
              fields: previous,
              undo: true,
            }),
        },
        duration: 8000,
      });
    },
  });
  return mutation;
}
