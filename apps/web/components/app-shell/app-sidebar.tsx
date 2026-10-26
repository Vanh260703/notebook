'use client';

import type { TagWithCount } from '@notebook/shared';
import { Hash, Inbox, NotebookPen, NotebookText, Plus, Tags, Trash2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { HealthStatus } from '@/components/health-status';
import { LogoutButton } from '@/components/logout-button';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { GuardedLink } from '@/components/unsaved-guard';
import { cn } from '@/lib/utils';
import { NAV, isNavActive, isTagActive, pickSidebarTags, type NavKey } from './nav';
import { useNavCounts, useTags } from './use-nav-counts';

export const NAV_ICON: Record<NavKey, typeof Inbox> = {
  inbox: Inbox,
  notes: NotebookText,
  tags: Tags,
  trash: Trash2,
};

/** Sidebar desktop (từ md). Mobile dùng MobileTabBar. */
export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside
      aria-label="Thanh bên"
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
    >
      <div className="flex h-14 shrink-0 items-center px-4">
        <GuardedLink
          href="/notes"
          className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-elev-1">
            <NotebookPen className="size-4" aria-hidden />
          </span>
          Notebook
        </GuardedLink>
      </div>
      <div className="shrink-0 px-3 pb-3">
        <GuardedLink
          href="/notes/new"
          className={buttonVariants({ className: 'w-full justify-start' })}
        >
          <Plus aria-hidden />
          Note mới
        </GuardedLink>
        {/* GĐ2: nút Tìm kiếm (Ctrl K) dạng ô giả, h-8, ngay dưới. */}
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {/* ?tag= cần useSearchParams: bọc Suspense để các trang tĩnh vẫn prerender được. */}
        <Suspense fallback={<SidebarBody pathname={pathname} tag={null} />}>
          <SidebarBodyWithParams pathname={pathname} />
        </Suspense>
      </div>
      {/* Xếp dọc: "Giao diện sáng" và "Đăng xuất" không vừa một hàng 216px với font Be Vietnam Pro. */}
      <div className="flex shrink-0 flex-col items-start gap-0.5 border-t border-sidebar-border p-3">
        <HealthStatus className="mb-1" />
        <ThemeToggle withLabel className="w-full justify-start px-2" />
        <LogoutButton className="w-full justify-start px-2" />
      </div>
    </aside>
  );
}

function SidebarBodyWithParams({ pathname }: { pathname: string }) {
  const tag = useSearchParams().get('tag');
  return <SidebarBody pathname={pathname} tag={tag} />;
}

function SidebarBody({ pathname, tag }: { pathname: string; tag: string | null }) {
  const counts = useNavCounts();
  const tags = useTags();
  return (
    <>
      <nav aria-label="Chính">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <li key={item.key}>
              <NavLink
                href={item.href}
                label={item.label}
                icon={NAV_ICON[item.key]}
                active={isNavActive(item.key, pathname, tag)}
                count={counts[item.key]}
                unit={item.key === 'tags' ? 'tag' : 'note'}
                highlight={item.key === 'inbox'}
              />
            </li>
          ))}
        </ul>
      </nav>
      {tags ? <SidebarTags tags={tags} pathname={pathname} tag={tag} /> : null}
    </>
  );
}

const itemBase =
  'flex items-center rounded-md px-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-foreground';
const itemActive = 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground';

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  count,
  unit,
  highlight,
}: {
  href: string;
  label: string;
  icon: typeof Inbox;
  active: boolean;
  count: number | undefined;
  unit: string;
  /** Inbox: số > 0 hiện thành badge hổ phách ("cần sắp xếp"). */
  highlight?: boolean;
}) {
  return (
    <GuardedLink
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        itemBase,
        'h-8 gap-2.5 font-medium text-muted-foreground pointer-coarse:h-10',
        active && itemActive,
      )}
    >
      <Icon className={cn('size-4 shrink-0', active && 'text-primary-ink')} aria-hidden />
      {label}
      {/* Đang tải: chưa hiện số, giữ min-w để layout không nhảy. */}
      <span
        className={cn(
          'ml-auto min-w-6 text-right text-xs tabular-nums',
          highlight &&
            count !== undefined &&
            count > 0 &&
            'rounded-full bg-status-inbox-bg px-1.5 text-center font-semibold text-status-inbox',
        )}
      >
        {count !== undefined ? (
          <>
            <span className="sr-only">: </span>
            {count}
            <span className="sr-only"> {unit}</span>
          </>
        ) : null}
      </span>
    </GuardedLink>
  );
}

function SidebarTags({
  tags,
  pathname,
  tag,
}: {
  tags: TagWithCount[];
  pathname: string;
  tag: string | null;
}) {
  const { items, hasMore } = pickSidebarTags(tags);
  if (!items.length) return null;
  return (
    <section aria-labelledby="sb-tags" className="mt-6">
      <h2
        id="sb-tags"
        className="px-2 pb-1.5 text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase"
      >
        Tag
      </h2>
      <ul className="flex flex-col gap-0.5">
        {items.map((t) => {
          const active = isTagActive(t.name, pathname, tag);
          return (
            <li key={t.id}>
              <GuardedLink
                href={`/notes?tag=${encodeURIComponent(t.name)}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  itemBase,
                  'h-7 gap-2 text-muted-foreground pointer-coarse:h-10',
                  active && itemActive,
                )}
              >
                <Hash className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{t.name}</span>
                <span className="ml-auto text-xs tabular-nums">
                  <span className="sr-only">: </span>
                  {t.noteCount}
                  <span className="sr-only"> note</span>
                </span>
              </GuardedLink>
            </li>
          );
        })}
      </ul>
      {hasMore ? (
        <GuardedLink
          href="/tags"
          className={cn(itemBase, 'mt-0.5 h-7 text-xs text-muted-foreground pointer-coarse:h-10')}
        >
          Xem tất cả {tags.length} tag
          <span aria-hidden className="ml-1">
            →
          </span>
        </GuardedLink>
      ) : null}
    </section>
  );
}
