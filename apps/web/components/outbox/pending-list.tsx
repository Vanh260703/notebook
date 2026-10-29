'use client';

import { CircleAlert, CloudOff, Copy, LogIn, RefreshCw, Trash2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { copyText } from '@/lib/clipboard';
import { formatTime } from '@/lib/date';
import { stripMarkdown } from '@/lib/markdown';
import type { OutboxRecord } from '@/lib/outbox/types';
import { cn } from '@/lib/utils';
import { useOutbox } from './outbox-provider';

/** Tiêu đề hiển thị của note chờ gửi: tiêu đề, hoặc dòng đầu của nội dung. */
export function pendingTitle(r: OutboxRecord): string {
  const title = r.input.title?.trim();
  if (title) return title;
  const first = (r.input.content ?? '').split('\n').find((l) => l.trim());
  return first ? stripMarkdown(first) : 'Không có tiêu đề';
}

/** "thử lại sau 40 giây" / "thử lại sau 2 phút" / "đang gửi…". */
export function retryIn(nextAttemptAt: number, now: number): string {
  const s = Math.ceil((nextAttemptAt - now) / 1000);
  if (s <= 0) return 'đang gửi…';
  if (s < 60) return `thử lại sau ${s} giây`;
  return `thử lại sau ${Math.ceil(s / 60)} phút`;
}

function useNow(active: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

/**
 * Note chưa lên server (đầu trang Inbox). Ẩn record có id đã nằm trong danh sách server đang hiện
 * (`hideIds`), để không lặp trong lúc chờ refetch.
 */
export function PendingList({ hideIds }: { hideIds?: ReadonlySet<string> }) {
  const { records, authRequired, retry, remove } = useOutbox();
  const pathname = usePathname();
  const sp = useSearchParams();
  const visible = records.filter((r) => !hideIds?.has(r.id));
  const now = useNow(visible.length > 0);
  const [confirm, setConfirm] = useState<OutboxRecord | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  if (!visible.length) return null;

  const copy = async (r: OutboxRecord) => {
    const text = r.input.title
      ? `# ${r.input.title}\n\n${r.input.content ?? ''}`
      : (r.input.content ?? '');
    if (await copyText(text)) toast.success('Đã sao chép');
    else toast.error('Không sao chép được');
  };

  const next = pathname + (sp.toString() ? `?${sp.toString()}` : '');

  return (
    <section
      aria-labelledby="pending-heading"
      className="rounded-xl border border-dashed border-warning/60 bg-warning-bg/40 p-3 md:p-4"
    >
      <h2 id="pending-heading" className="flex items-center gap-2 text-sm font-semibold">
        <CloudOff className="size-4 text-warning" aria-hidden />
        Chờ gửi lên server <span className="tabular-nums">({visible.length})</span>
      </h2>
      {authRequired ? (
        <p role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          Phiên đăng nhập đã hết hạn.
          <a
            href={`/login?next=${encodeURIComponent(next)}`}
            className="inline-flex items-center gap-1 font-medium text-primary-ink underline-offset-4 hover:underline pointer-coarse:py-2"
          >
            <LogIn className="size-3.5" aria-hidden />
            Đăng nhập lại
          </a>
          để gửi {visible.length} note.
        </p>
      ) : null}
      <ul className="mt-2 flex flex-col divide-y divide-border">
        {visible.map((r) => {
          const failed = r.state === 'failed';
          const Icon = failed ? CircleAlert : CloudOff;
          const name = pendingTitle(r);
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <Icon
                className={cn('size-4 shrink-0', failed ? 'text-destructive' : 'text-warning')}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className={cn('text-xs', failed ? 'text-destructive' : 'text-muted-foreground')}>
                  Ghi lúc {formatTime(r.queuedAt)} ·{' '}
                  {failed
                    ? `Lỗi: ${r.lastError?.message ?? 'không rõ'}`
                    : authRequired
                      ? 'chờ đăng nhập lại'
                      : retryIn(r.nextAttemptAt, now)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void retry(r.id)}
                  aria-label={`Gửi lại ${name}`}
                  title="Gửi lại"
                >
                  <RefreshCw />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void copy(r)}
                  aria-label={`Sao chép ${name}`}
                  title="Sao chép"
                >
                  <Copy />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setConfirm(r)}
                  aria-label={`Xóa ${name}`}
                  title="Xóa"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent showCloseButton={false} initialFocus={cancelRef}>
          <DialogHeader>
            <DialogTitle className="break-words">
              Xóa &ldquo;{confirm ? pendingTitle(confirm) : ''}&rdquo;?
            </DialogTitle>
            <DialogDescription>Note này chưa có trên server. Xóa là mất hẳn.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button ref={cancelRef} variant="outline" onClick={() => setConfirm(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm) void remove(confirm.id);
                setConfirm(null);
              }}
            >
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
