'use client';

import { ListTree } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
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

function TocList({ items, active }: { items: TocItem[]; active?: string | null }) {
  return (
    <ul className="flex flex-col gap-0.5 text-sm">
      {items.map((it) => (
        <li key={it.id} className={indent[it.level]}>
          {/* Link hash thường (như skip link), cuộn mượt nhờ scroll-behavior; reduced motion tự tắt. */}
          <a
            href={`#${it.id}`}
            aria-current={active === it.id ? 'location' : undefined}
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

/** Mục lục dạng thu gọn (dưới xl), ngay dưới dòng meta. */
export function TocDetails({ items }: { items: TocItem[] }) {
  return (
    <details className="group rounded-xl border bg-card px-3 py-2 shadow-elev-1 xl:hidden">
      <summary className="flex cursor-pointer items-center gap-2 py-1 text-sm font-medium pointer-coarse:py-2">
        <ListTree className="size-4 text-muted-foreground" aria-hidden />
        Mục lục ({items.length})
      </summary>
      <nav aria-label="Mục lục" className="mt-1 pb-1">
        <TocList items={items} />
      </nav>
    </details>
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
