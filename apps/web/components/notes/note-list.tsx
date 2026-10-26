'use client';

import type { NoteListItem } from '@notebook/shared';
import { CalendarDays, Pin, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GuardedLink } from '@/components/unsaved-guard';
import {
  formatDateTime,
  formatDeleted,
  formatRelative,
  formatShortDay,
  isDifferentDay,
} from '@/lib/date';
import { pickFocusAfterRemoval } from '@/lib/list-focus';
import { stripMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import { StatusChip, TagChip, TYPE_META, TypeLabel } from './note-meta';
import {
  useDeleteNote,
  useDeleteNotePermanently,
  useRestoreNote,
  useTogglePin,
} from './use-note-actions';

/** Ẩn khi có chuột và không hover/focus trong card. Màn cảm ứng (không hover) luôn hiện. */
const revealOnHover =
  'pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100';

const groupHeading =
  'mb-2 text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase';

const listClass = 'flex flex-col gap-2 md:gap-2.5';

const MAX_TAGS = 3;

type Variant = 'default' | 'trash';

/**
 * Danh sách note dạng card. Link phủ toàn card (bấm đâu cũng mở note), tên link chỉ là tiêu đề.
 * - `default`: ghim, xóa (vào thùng rác); có note ghim thì tách nhóm "Đã ghim" / "Ghi chú khác".
 * - `trash`: khôi phục, xóa vĩnh viễn (có hỏi lại); link mở view chỉ đọc.
 * Sau khi gỡ một card, focus sang card kế tiếp (rồi card trước, rồi h1 của trang).
 */
export function NoteList({
  items,
  variant = 'default',
  onTagClick,
  showStatus = true,
}: {
  items: NoteListItem[];
  variant?: Variant;
  onTagClick?: (tag: string) => void;
  /** Ẩn chip trạng thái (trang Inbox: mọi note đều là Inbox). */
  showStatus?: boolean;
}) {
  const pin = useTogglePin();
  const del = useDeleteNote();
  const restore = useRestoreNote();
  const purge = useDeleteNotePermanently();
  const [confirmPurge, setConfirmPurge] = useState<NoteListItem | null>(null);
  const purgeFocus = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const refocusPin = useRef<string | null>(null);

  /** Đích focus sau khi gỡ `id`, chọn trước khi gỡ để focus không rơi về body. */
  const focusTargetAfterRemoval = (id: string): HTMLElement | null => {
    const nextId = pickFocusAfterRemoval(
      items.map((i) => i.id),
      id,
    );
    return (
      (nextId && document.querySelector<HTMLElement>(`[data-note-link="${nextId}"]`)) ||
      document.querySelector<HTMLElement>('main h1')
    );
  };

  const removeWith = (id: string, mutate: (id: string) => void) => {
    const target = focusTargetAfterRemoval(id);
    mutate(id);
    requestAnimationFrame(() => target?.focus());
  };

  // Ghim/bỏ ghim chuyển card sang nhóm khác (mount lại): đưa focus về lại nút ghim của nó.
  useEffect(() => {
    const id = refocusPin.current;
    if (!id) return;
    refocusPin.current = null;
    document.querySelector<HTMLElement>(`[data-pin-for="${id}"]`)?.focus();
  }, [items]);

  const togglePin = (note: NoteListItem) => {
    refocusPin.current = note.id;
    pin.mutate(note);
  };

  const renderCard = (note: NoteListItem, index: number, heading: 'h2' | 'h3') => {
    const Heading = heading;
    const name = note.title || 'Không có tiêu đề';
    const excerpt = stripMarkdown(note.excerpt);
    const archived = note.status === 'ARCHIVED';
    const extraTags = note.tags.slice(MAX_TAGS);
    return (
      <li
        key={note.id}
        style={{ '--i': Math.min(index, 8) } as CSSProperties}
        className={cn(
          'group relative flex gap-2 rounded-xl border bg-card p-4 shadow-elev-1 transition-[box-shadow,border-color] duration-150',
          'hover:border-[color-mix(in_oklch,var(--border),var(--primary)_35%)] hover:shadow-elev-2',
          // Focus ring nằm trên cả card (link phủ toàn card tự tắt outline của nó).
          'has-[[data-note-link]:focus-visible]:outline-2 has-[[data-note-link]:focus-visible]:outline-offset-2 has-[[data-note-link]:focus-visible]:outline-ring',
          'animate-in fill-mode-both duration-200 fade-in-0 slide-in-from-bottom-1 [animation-delay:calc(var(--i)*30ms)] motion-reduce:animate-none',
          'pointer-coarse:p-3.5',
          archived && 'bg-card/60 shadow-none',
        )}
      >
        {/* Vạch màu theo loại (trang trí; loại có chữ ở dòng meta). */}
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-4 left-0 w-[3px] rounded-r-full',
            TYPE_META[note.type].bar,
          )}
        />
        <div className="min-w-0 flex-1">
          <Heading
            className={cn(
              'text-[0.9375rem] leading-snug font-semibold break-words md:text-base',
              archived && 'text-muted-foreground',
            )}
          >
            {note.pinned && variant === 'default' ? (
              <>
                <Pin
                  aria-hidden
                  className="mr-1.5 inline size-3.5 -translate-y-px fill-current text-primary-ink"
                />
                <span className="sr-only">Đã ghim, </span>
              </>
            ) : null}
            <GuardedLink
              href={`/notes/${note.id}`}
              data-note-link={note.id}
              className="after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none"
            >
              {note.title || <span className="text-muted-foreground">Không có tiêu đề</span>}
            </GuardedLink>
          </Heading>
          {excerpt ? (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed break-words text-muted-foreground pointer-coarse:line-clamp-3">
              {excerpt}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
            <TypeLabel type={note.type} />
            {showStatus ? <StatusChip status={note.status} /> : null}
            {note.tags.slice(0, MAX_TAGS).map((t) => (
              <TagChip key={t.id} name={t.name} onClick={onTagClick} />
            ))}
            {extraTags.length ? (
              <span
                className="text-muted-foreground"
                title={extraTags.map((t) => `#${t.name}`).join(' ')}
              >
                +{extraTags.length}
                <span className="sr-only"> tag</span>
              </span>
            ) : null}
            <span className="ml-auto text-muted-foreground tabular-nums">
              {variant === 'trash' && note.deletedAt ? (
                <time dateTime={note.deletedAt} title={`Xóa lúc ${formatDateTime(note.deletedAt)}`}>
                  {formatDeleted(note.deletedAt)}
                </time>
              ) : (
                <time dateTime={note.updatedAt} title={`Sửa lúc ${formatDateTime(note.updatedAt)}`}>
                  <span className="sr-only">Sửa </span>
                  {formatRelative(note.updatedAt)}
                </time>
              )}
              {variant === 'default' && isDifferentDay(note.updatedAt, note.entryDate) ? (
                <>
                  <span aria-hidden> · </span>
                  <span title="Ngày của note">
                    <CalendarDays className="inline size-3 -translate-y-px" aria-hidden />
                    <span className="sr-only">, ngày của note</span>{' '}
                    {formatShortDay(note.entryDate)}
                  </span>
                </>
              ) : null}
            </span>
          </div>
        </div>
        <div className="relative z-10 -mt-1 -mr-1 flex shrink-0 items-start gap-1 pointer-coarse:gap-2">
          {variant === 'trash' ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeWith(note.id, (id) => restore.mutate(id))}
                disabled={restore.isPending && restore.variables === note.id}
                aria-label={`Khôi phục ${name}`}
                title="Khôi phục"
                className={revealOnHover}
              >
                <RotateCcw />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  purgeFocus.current = null;
                  setConfirmPurge(note);
                }}
                aria-label={`Xóa vĩnh viễn ${name}`}
                title="Xóa vĩnh viễn"
                className={cn('text-destructive hover:text-destructive', revealOnHover)}
              >
                <Trash2 />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                data-pin-for={note.id}
                onClick={() => togglePin(note)}
                disabled={pin.isPending && pin.variables?.id === note.id}
                // Giữ focus khi đang chờ (nút disabled thật sẽ làm rơi focus về body).
                focusableWhenDisabled
                aria-pressed={note.pinned}
                aria-label={note.pinned ? `Bỏ ghim ${name}` : `Ghim ${name}`}
                title={note.pinned ? 'Bỏ ghim' : 'Ghim'}
                className={cn(!note.pinned && revealOnHover)}
              >
                <Pin className={cn(note.pinned && 'fill-current text-primary-ink')} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeWith(note.id, (id) => del.mutate(id))}
                aria-label={`Xóa ${name}`}
                title="Xóa (chuyển vào thùng rác)"
                className={revealOnHover}
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </li>
    );
  };

  const pinned = variant === 'default' ? items.filter((n) => n.pinned) : [];
  const others = items.filter((n) => !pinned.includes(n));

  return (
    <>
      {pinned.length ? (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="group-pinned">
            <h2 id="group-pinned" className={groupHeading}>
              Đã ghim <span aria-hidden>·</span>{' '}
              <span className="tabular-nums">{pinned.length}</span>
            </h2>
            <ul className={listClass}>{pinned.map((n, i) => renderCard(n, i, 'h3'))}</ul>
          </section>
          {others.length ? (
            <section aria-labelledby="group-other">
              <h2 id="group-other" className={groupHeading}>
                Ghi chú khác
              </h2>
              <ul className={listClass}>
                {others.map((n, i) => renderCard(n, pinned.length + i, 'h3'))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : (
        <ul className={listClass}>{items.map((n, i) => renderCard(n, i, 'h2'))}</ul>
      )}

      {variant === 'trash' ? (
        <Dialog open={confirmPurge !== null} onOpenChange={(o) => !o && setConfirmPurge(null)}>
          <DialogContent
            showCloseButton={false}
            initialFocus={cancelRef}
            // Xóa xong: focus sang card kế tiếp thay vì nút vừa bị gỡ cùng card.
            finalFocus={() => purgeFocus.current ?? true}
          >
            <DialogHeader>
              <DialogTitle className="break-words">
                Xóa vĩnh viễn &ldquo;{confirmPurge?.title || 'Không có tiêu đề'}&rdquo;?
              </DialogTitle>
              <DialogDescription>
                Note sẽ bị xóa hẳn khỏi server, không khôi phục được.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button ref={cancelRef} variant="outline" onClick={() => setConfirmPurge(null)}>
                Hủy
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!confirmPurge) return;
                  purgeFocus.current = focusTargetAfterRemoval(confirmPurge.id);
                  purge.mutate(confirmPurge.id);
                  setConfirmPurge(null);
                }}
              >
                Xóa vĩnh viễn
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
