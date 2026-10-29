'use client';

import { ListTree } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Mục lục lấy từ DOM sau khi render (h2–h4 có id do rehypeHeadingIds gán), không phân tích lại
 * Markdown: mục lục và nội dung không bao giờ lệch nhau. `version` đổi thì đọc lại.
 */
export function useToc(articleRef: RefObject<HTMLElement | null>, version: unknown): TocItem[] {
  const [items, setItems] = useState<TocItem[]>([]);
  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const found = Array.from(el.querySelectorAll<HTMLElement>(':is(h2,h3,h4)[id]')).map((h) => ({
      id: h.id,
      text: h.textContent?.trim() || h.id,
      level: Number(h.tagName[1]),
    }));
    setItems(found);
  }, [articleRef, version]);
  return items;
}

/** Heading đang đọc (scrollspy): heading cuối cùng đã đi qua 30% trên của màn hình. */
export function useActiveHeading(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!ids.length || typeof IntersectionObserver === 'undefined') return;
    const visible = new Set<string>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = ids.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

const indent: Record<number, string> = { 2: '', 3: 'pl-3', 4: 'pl-6' };

function TocList({
  items,
  active,
  onPick,
}: {
  items: TocItem[];
  active?: string | null;
  /** Có thì bấm một mục gọi hàm này thay vì đi theo link hash (sheet: đóng rồi mới cuộn). */
  onPick?: (id: string, e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5 text-sm">
      {items.map((it) => (
        <li key={it.id} className={indent[it.level]}>
          {/* Link hash thường (như skip link), cuộn mượt nhờ scroll-behavior; reduced motion tự tắt. */}
          <a
            href={`#${it.id}`}
            aria-current={active === it.id ? 'location' : undefined}
            onClick={onPick ? (e) => onPick(it.id, e) : undefined}
            className={cn(
              'block rounded-md px-2 py-1 leading-snug text-muted-foreground hover:bg-muted hover:text-foreground pointer-coarse:py-2',
              active === it.id && 'font-medium text-primary-ink',
            )}
          >
            {it.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Nút "Mục lục" trên thanh dính (dưới xl): mở bottom sheet chứa mục lục, mục đang đọc được đánh dấu.
 * Mở lại được ở bất cứ đâu trong bài. Bấm một mục: đóng sheet, xong animation (khóa cuộn đã gỡ) mới
 * đi tới heading bằng hash, như link mục lục thường (cuộn mượt, Back quay lại, scroll-mt của heading).
 */
export function TocSheet({ items, active }: { items: TocItem[]; active: string | null }) {
  const [open, setOpen] = useState(false);
  const target = useRef<string | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) target.current = null;
        setOpen(o);
      }}
      onOpenChangeComplete={(o) => {
        const id = target.current;
        if (o || !id) return;
        target.current = null;
        // Hash không đổi (chọn lại cùng mục) thì trình duyệt không cuộn: tự cuộn.
        if (window.location.hash === `#${id}`) document.getElementById(id)?.scrollIntoView();
        else window.location.hash = id;
      }}
    >
      <DialogTrigger
        render={<Button variant="ghost" size="sm" className="xl:hidden" />}
        aria-haspopup="dialog"
      >
        <ListTree aria-hidden />
        Mục lục
      </DialogTrigger>
      <DialogContent
        className="pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        // Chọn một mục: focus không quay về nút (Tab tiếp theo đi từ heading vừa tới).
        finalFocus={() => target.current === null}
      >
        <DialogHeader>
          <DialogTitle>Mục lục</DialogTitle>
        </DialogHeader>
        <nav aria-label="Mục lục" className="-mx-2">
          <TocList
            items={items}
            active={active}
            onPick={(id, e) => {
              e.preventDefault();
              target.current = id;
              setOpen(false);
            }}
          />
        </nav>
      </DialogContent>
    </Dialog>
  );
}

/** Mục lục cột phải (xl+), dính khi cuộn, mục đang đọc có aria-current="location". */
export function TocAside({ items, active }: { items: TocItem[]; active: string | null }) {
  return (
    <nav
      aria-labelledby="toc-heading"
      className="sticky top-16 hidden max-h-[calc(100dvh-5rem)] overflow-y-auto xl:block"
    >
      <h2
        id="toc-heading"
        className="mb-2 px-2 text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase"
      >
        Mục lục
      </h2>
      <TocList items={items} active={active} />
    </nav>
  );
}
