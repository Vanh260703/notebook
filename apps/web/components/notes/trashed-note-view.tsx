'use client';

import type { Note } from '@notebook/shared';
import { CalendarDays, RotateCcw, Trash2 } from 'lucide-react';
import { MarkdownPreview } from '@/components/editor/markdown-preview';
import { Button } from '@/components/ui/button';
import { formatEntryDate, formatTrashExpiry } from '@/lib/date';
import { StatusChip, TagChip, TypeLabel } from './note-meta';

/**
 * Note trong thùng rác: view chỉ đọc riêng thay cho form (không có ô nhập bị khóa, không bật
 * bàn phím ảo). Khôi phục xong thì NoteForm hiện lại form và focus vào tiêu đề.
 * "Xóa vĩnh viễn" nằm ở trang /trash, không đặt ở đây.
 */
export function TrashedNoteView({
  note,
  restoring,
  onRestore,
}: {
  note: Note;
  restoring: boolean;
  onRestore: () => void;
}) {
  return (
    <article className="flex flex-col gap-4">
      <div
        role="status"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm"
      >
        <Trash2 className="size-4 shrink-0 text-warning" aria-hidden />
        <span className="mr-auto">
          Note này đang trong thùng rác. Khôi phục để sửa.
          {note.deletedAt ? <> {formatTrashExpiry(note.deletedAt).sentence}</> : null}
        </span>
        <Button onClick={onRestore} disabled={restoring}>
          <RotateCcw aria-hidden />
          {restoring ? 'Đang khôi phục…' : 'Khôi phục'}
        </Button>
      </div>

      <h1 className="text-2xl leading-tight font-bold tracking-[-0.02em] break-words md:text-3xl">
        {note.title || <span className="text-muted-foreground">Không có tiêu đề</span>}
      </h1>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
        <TypeLabel type={note.type} />
        <StatusChip status={note.status} />
        <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
          <CalendarDays className="size-3.5" aria-hidden />
          <span className="sr-only">Ngày của note: </span>
          {formatEntryDate(note.entryDate)}
        </span>
        {note.tags.length ? (
          <>
            <span className="sr-only">Tag:</span>
            {note.tags.map((t) => (
              <TagChip key={t.id} name={t.name} />
            ))}
          </>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card px-5 py-4 shadow-elev-1">
        <MarkdownPreview content={note.content} className="md:prose-base" />
      </div>
    </article>
  );
}
