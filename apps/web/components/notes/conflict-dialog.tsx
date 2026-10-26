'use client';

import type { Note } from '@notebook/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/date';
import type { NoteDraft } from '@/lib/note-draft';
import { cn } from '@/lib/utils';

function Side({
  label,
  dot,
  title,
  content,
}: {
  label: string;
  /** Chấm màu phân biệt hai bản (trang trí, đã có chữ ở nhãn). */
  dot: string;
  title: string;
  content: string;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        <span aria-hidden className={cn('size-2 rounded-full', dot)} />
        {label}
      </h3>
      <div className="flex max-h-[22dvh] flex-col overflow-auto rounded-lg border bg-muted/40 p-3 md:max-h-[50dvh]">
        <p className="mb-2 font-medium break-words">{title || 'Không có tiêu đề'}</p>
        <pre className="font-mono text-xs break-words whitespace-pre-wrap">{content}</pre>
      </div>
    </section>
  );
}

/** 409 VERSION_CONFLICT: cho chọn giữ bản nào, không bao giờ ghi đè im lặng. */
export function ConflictDialog({
  current,
  mine,
  busy,
  onKeepMine,
  onUseServer,
  onCopyMine,
  onClose,
}: {
  current: Note | null;
  mine: NoteDraft;
  busy: boolean;
  onKeepMine: () => void;
  onUseServer: () => void;
  onCopyMine: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={current !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Note đã được sửa ở nơi khác</DialogTitle>
          {current ? (
            <DialogDescription>
              Bản trên server là phiên bản {current.version}, sửa lúc{' '}
              {formatDateTime(current.updatedAt)}. Chọn bản muốn giữ.
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {current ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Side
              label="Bản của tôi (chưa lưu)"
              dot="bg-primary"
              title={mine.title}
              content={mine.content}
            />
            <Side
              label="Bản trên server"
              dot="bg-muted-foreground"
              title={current.title}
              content={current.content}
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onCopyMine}>
            Sao chép bản của tôi
          </Button>
          <Button variant="secondary" onClick={onUseServer} disabled={busy}>
            Dùng bản trên server
          </Button>
          <Button onClick={onKeepMine} disabled={busy}>
            Giữ bản của tôi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 404 NOTE_IN_TRASH khi lưu: note đã bị xóa ở nơi khác. */
export function TrashedOnSaveDialog({
  open,
  busy,
  onRestoreAndSave,
  onCopy,
  onClose,
}: {
  open: boolean;
  busy: boolean;
  onRestoreAndSave: () => void;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Note đang trong thùng rác</DialogTitle>
          <DialogDescription>
            Note này đã bị xóa ở nơi khác nên chưa lưu được. Khôi phục rồi lưu, hoặc sao chép nội
            dung ra ngoài.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCopy}>
            Sao chép nội dung
          </Button>
          <Button onClick={onRestoreAndSave} disabled={busy}>
            Khôi phục rồi lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
