'use client';

import type { NoteListItem, NoteType } from '@notebook/shared';
import { CircleAlert, CloudOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusChip, TagChip, TYPE_META, TypeLabel } from '@/components/notes/note-meta';
import { GuardedLink } from '@/components/unsaved-guard';
import { formatDateTime, formatTime, localDate } from '@/lib/date';
import { stripMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';

/** Note còn trong outbox (chưa lên server) có entryDate đúng ngày đang xem. */
export interface PendingEntry {
  id: string;
  title: string;
  content: string;
  type: NoteType;
  /** Lúc ghi (ISO), dùng để xếp chỗ trong dòng thời gian. */
  createdAt: string;
  failed: boolean;
}

type Entry = { kind: 'note'; note: NoteListItem } | { kind: 'pending'; entry: PendingEntry };

const at = (e: Entry) => (e.kind === 'note' ? e.note.createdAt : e.entry.createdAt);

/** Ghép note trên server với note chờ gửi, theo giờ ghi tăng dần (bỏ bản chờ gửi đã có trên server). */
export function mergeTimeline(items: NoteListItem[], pending: PendingEntry[]): Entry[] {
  const onServer = new Set(items.map((n) => n.id));
  const entries: Entry[] = [
    ...items.map((note) => ({ kind: 'note' as const, note })),
    ...pending
      .filter((p) => !onServer.has(p.id))
      .map((entry) => ({ kind: 'pending' as const, entry })),
  ];
  return entries.sort((a, b) => Date.parse(at(a)) - Date.parse(at(b)));
}

/**
 * Dòng thời gian của một ngày: giờ ghi bên trái, chấm màu theo loại nối bằng đường dọc, card gọn.
 * `actions(note)`: nút thêm cho từng note (ví dụ "Đọc").
 */
export function Timeline({
  date,
  items,
  pending = [],
  actions,
}: {
  date: string;
  items: NoteListItem[];
  pending?: PendingEntry[];
  actions?: (note: NoteListItem) => ReactNode;
}) {
  const entries = mergeTimeline(items, pending);
  return (
    <ol className="flex flex-col">
      {entries.map((e, i) => {
        const last = i === entries.length - 1;
        const type = e.kind === 'note' ? e.note.type : e.entry.type;
        const created = at(e);
        return (
          <li
            key={e.kind === 'note' ? e.note.id : `p-${e.entry.id}`}
            className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2 md:grid-cols-[3rem_minmax(0,1fr)] md:gap-x-3"
          >
            <time
              dateTime={created}
              title={formatDateTime(created)}
              className="pt-3.5 text-right text-xs font-medium text-muted-foreground tabular-nums"
            >
              {formatTime(created)}
            </time>
            <div className={cn('relative pl-5', !last && 'pb-3')}>
              {/* Đường dọc nối các chấm + chấm màu theo loại (trang trí; loại có chữ ở dòng meta). */}
              {!last ? (
                <span aria-hidden className="absolute top-5 bottom-0 left-[5px] w-px bg-border" />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  'absolute top-4 left-0 size-[11px] rounded-full ring-4 ring-background',
                  e.kind === 'pending'
                    ? 'border-2 border-dashed border-warning'
                    : TYPE_META[type].bar,
                )}
              />
              {e.kind === 'note' ? (
                <NoteCard note={e.note} date={date} actions={actions?.(e.note)} />
              ) : (
                <PendingCard entry={e.entry} />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function NoteCard({
  note,
  date,
  actions,
}: {
  note: NoteListItem;
  date: string;
  actions: ReactNode;
}) {
  const excerpt = stripMarkdown(note.excerpt);
  // Note ghi lùi ngày: giờ ghi thật nằm ở ngày khác.
  const backdated = localDate(new Date(note.createdAt)) !== date;
  return (
    <article
      className={cn(
        'group relative rounded-xl border bg-card p-3.5 shadow-elev-1 transition-[box-shadow,border-color] duration-150 md:p-4',
        'hover:border-[color-mix(in_oklch,var(--border),var(--primary)_35%)] hover:shadow-elev-2',
        'has-[[data-note-link]:focus-visible]:outline-2 has-[[data-note-link]:focus-visible]:outline-offset-2 has-[[data-note-link]:focus-visible]:outline-ring',
        note.status === 'ARCHIVED' && 'bg-card/60 shadow-none',
      )}
    >
      <h2
        className={cn(
          'text-[0.9375rem] leading-snug font-semibold break-words md:text-base',
          actions && 'pr-8 pointer-coarse:pr-10',
        )}
      >
        <GuardedLink
          href={`/notes/${note.id}`}
          data-note-link={note.id}
          className="after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none"
        >
          {note.title || <span className="text-muted-foreground">Không có tiêu đề</span>}
        </GuardedLink>
      </h2>
      {/* Nút (ví dụ "Đọc") nằm ngoài luồng: tiêu đề một dòng không bị nút 44px đẩy đoạn trích
          xuống. Đặt sau h2 để thứ tự đọc/Tab vẫn là tên note trước. */}
      {actions ? <div className="absolute top-2 right-2 z-10 flex gap-1">{actions}</div> : null}
      {excerpt ? (
        <p className="mt-1 line-clamp-3 text-sm leading-relaxed break-words text-muted-foreground">
          {excerpt}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
        <TypeLabel type={note.type} />
        <StatusChip status={note.status} />
        {note.tags.slice(0, 3).map((t) => (
          <TagChip key={t.id} name={t.name} />
        ))}
        {note.tags.length > 3 ? (
          <span className="text-muted-foreground">
            +{note.tags.length - 3}
            <span className="sr-only"> tag</span>
          </span>
        ) : null}
        {backdated ? (
          <span className="ml-auto text-muted-foreground tabular-nums">
            viết lúc {formatTime(note.createdAt)}, {formatShortDate(note.createdAt)}
          </span>
        ) : null}
      </div>
    </article>
  );
}

const formatShortDate = (iso: string) => {
  const [, m, d] = localDate(new Date(iso)).split('-');
  return `${d}/${m}`;
};

function PendingCard({ entry }: { entry: PendingEntry }) {
  const firstLine = entry.content.split('\n').find((l) => l.trim()) ?? '';
  const Icon = entry.failed ? CircleAlert : CloudOff;
  return (
    <article className="rounded-xl border border-dashed border-warning/60 bg-card/60 p-3.5 md:p-4">
      <h2 className="text-[0.9375rem] leading-snug font-semibold break-words md:text-base">
        {entry.title || stripMarkdown(firstLine) || (
          <span className="text-muted-foreground">Không có tiêu đề</span>
        )}
      </h2>
      {entry.title && entry.content ? (
        <p className="mt-1 line-clamp-2 text-sm break-words text-muted-foreground">
          {stripMarkdown(entry.content)}
        </p>
      ) : null}
      {entry.failed ? (
        <GuardedLink
          href="/inbox"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-destructive underline-offset-4 hover:underline pointer-coarse:py-2"
        >
          <Icon className="size-3.5" aria-hidden />
          Gửi lỗi, xem ở Inbox
        </GuardedLink>
      ) : (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-warning">
          <Icon className="size-3.5" aria-hidden />
          Chờ gửi
        </p>
      )}
    </article>
  );
}
