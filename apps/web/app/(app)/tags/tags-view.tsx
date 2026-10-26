'use client';

import {
  tagNameSchema,
  tagNameTakenErrorSchema,
  type Tag,
  type TagWithCount,
} from '@notebook/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Hash, Pencil, Tags, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { QueryError } from '@/components/query-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { GuardedLink } from '@/components/unsaved-guard';
import { errorMessage, isApiError } from '@/lib/api/client';
import { deleteTag, listTags, renameTag } from '@/lib/api/tags';
import { qk } from '@/lib/query-keys';

type MergePrompt = { tag: TagWithCount; name: string; existing: Tag };

/** Ẩn khi có chuột và không hover/focus trong dòng. Màn cảm ứng luôn hiện. */
const revealOnHover =
  'pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100';

export function TagsView() {
  const qc = useQueryClient();
  const { data, error, isPending, refetch } = useQuery({ queryKey: qk.tags, queryFn: listTags });
  const [editing, setEditing] = useState<string | null>(null);
  const [mergePrompt, setMergePrompt] = useState<MergePrompt | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TagWithCount | null>(null);

  // Đổi tên/xóa tag làm thay đổi tag của note: tải lại cả note (form đang mở không giữ tên cũ).
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.tags });
    void qc.invalidateQueries({ queryKey: qk.notes });
  };

  const rename = useMutation({
    mutationFn: (v: { tag: TagWithCount; name: string; merge?: boolean }) =>
      renameTag(v.tag.id, { name: v.name, merge: v.merge }),
    onSuccess: (res, v) => {
      setEditing(null);
      setMergePrompt(null);
      refresh();
      toast.success(v.merge ? `Đã gộp vào #${res.name}` : `Đã đổi tên thành #${res.name}`);
    },
    onError: (e, v) => {
      if (isApiError(e, 'TAG_NAME_TAKEN')) {
        const parsed = tagNameTakenErrorSchema.safeParse(e.body);
        if (parsed.success) {
          setMergePrompt({ tag: v.tag, name: v.name, existing: parsed.data.existing });
          return;
        }
      }
      setMergePrompt(null);
      toast.error(errorMessage(e));
    },
  });

  const remove = useMutation({
    mutationFn: (tag: TagWithCount) => deleteTag(tag.id),
    onSuccess: (_d, tag) => {
      setConfirmDelete(null);
      refresh();
      toast.success(`Đã xóa #${tag.name}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const maxCount = Math.max(1, ...(data?.items.map((t) => t.noteCount) ?? []));

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5 md:gap-6">
      <PageHeader
        title="Tag"
        count={data?.items.length}
        unit="tag"
        description="Bấm tag để xem các note. Đổi tên trùng tag khác sẽ hỏi để gộp."
      />
      {error ? (
        <QueryError error={error} onRetry={() => void refetch()} title="Không tải được tag" />
      ) : isPending ? (
        <div role="status" aria-busy="true" className="rounded-xl border bg-card shadow-elev-1">
          <span className="sr-only">Đang tải…</span>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex h-12 items-center gap-3 border-b px-4 last:border-b-0">
              <Skeleton className="size-7" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto h-4 w-12" />
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState icon={Tags} title="Chưa có tag nào" text="Tag được tạo khi bạn gắn vào note." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card shadow-elev-1">
          {data.items.map((tag) => (
            <li
              key={tag.id}
              className="group flex min-h-12 items-center gap-3 px-4 py-1.5 pointer-coarse:min-h-14"
            >
              {editing === tag.id ? (
                <RenameForm
                  tag={tag}
                  busy={rename.isPending}
                  onCancel={() => setEditing(null)}
                  onSubmit={(name) => rename.mutate({ tag, name })}
                />
              ) : (
                <>
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-primary-ink">
                    <Hash className="size-3.5" aria-hidden />
                  </span>
                  <GuardedLink
                    href={`/notes?tag=${encodeURIComponent(tag.name)}`}
                    className="min-w-0 flex-1 truncate rounded-sm font-medium hover:text-primary-ink pointer-coarse:py-2"
                    title="Xem các note có tag này"
                  >
                    {tag.name}
                  </GuardedLink>
                  {/* Tỉ lệ số note so với tag nhiều note nhất (trang trí, số có ở chữ bên cạnh). */}
                  <span
                    aria-hidden
                    className="hidden h-1.5 w-24 shrink-0 rounded-full bg-muted sm:block"
                  >
                    <span
                      className="block h-full rounded-full bg-primary/70"
                      style={{ width: `${(tag.noteCount / maxCount) * 100}%` }}
                    />
                  </span>
                  <span className="w-16 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                    {tag.noteCount} note
                  </span>
                  <div className="flex shrink-0 items-center gap-1 pointer-coarse:gap-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing(tag.id)}
                      aria-label={`Đổi tên #${tag.name}`}
                      title="Đổi tên"
                      className={revealOnHover}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setConfirmDelete(tag)}
                      aria-label={`Xóa #${tag.name}`}
                      title="Xóa"
                      className={revealOnHover}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={mergePrompt !== null} onOpenChange={(o) => !o && setMergePrompt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gộp vào #{mergePrompt?.existing.name}?</DialogTitle>
            <DialogDescription>
              Đã có tag #{mergePrompt?.existing.name}. Gộp sẽ chuyển mọi note của #
              {mergePrompt?.tag.name} sang #{mergePrompt?.existing.name} rồi xóa #
              {mergePrompt?.tag.name}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergePrompt(null)}>
              Hủy
            </Button>
            <Button
              disabled={rename.isPending}
              onClick={() =>
                mergePrompt &&
                rename.mutate({ tag: mergePrompt.tag, name: mergePrompt.name, merge: true })
              }
            >
              Gộp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa #{confirmDelete?.name}?</DialogTitle>
            <DialogDescription>
              Tag sẽ bị gỡ khỏi {confirmDelete?.noteCount ?? 0} note. Các note vẫn giữ nguyên. Không
              hoàn tác được.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => confirmDelete && remove.mutate(confirmDelete)}
            >
              Xóa tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RenameForm({
  tag,
  busy,
  onSubmit,
  onCancel,
}: {
  tag: TagWithCount;
  busy: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = tagNameSchema.safeParse(value);
    if (!parsed.success) {
      setError('Tên tag từ 1 đến 64 ký tự');
      return;
    }
    if (parsed.data === tag.name) return onCancel();
    onSubmit(parsed.data);
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-wrap items-center gap-2">
      <Input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        aria-label={`Tên mới cho #${tag.name}`}
        aria-invalid={error ? true : undefined}
        autoFocus
        className="min-w-40 flex-1"
      />
      <Button type="submit" size="sm" disabled={busy}>
        Lưu
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Hủy
      </Button>
      {error ? (
        <p role="alert" className="w-full text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
