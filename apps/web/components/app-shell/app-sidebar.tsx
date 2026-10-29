'use client';

import type { TagWithCount } from '@notebook/shared';
import {
  CalendarDays,
  CircleAlert,
  CloudOff,
  Hash,
  Inbox,
  NotebookPen,
  NotebookText,
  Plus,
  Search,
  Tags,
  Trash2,
  Zap,
} from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useCommands } from '@/components/command/command-provider';
import { HealthStatus } from '@/components/health-status';
import { useOutbox } from '@/components/outbox/outbox-provider';
import { LogoutButton } from '@/components/logout-button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button, buttonVariants } from '@/components/ui/button';
import { GuardedLink } from '@/components/unsaved-guard';
import { isMacPlatform, shortcutLabel } from '@/lib/command';
import { useHydrated } from '@/lib/use-hydrated';
import { cn } from '@/lib/utils';
import { NAV, isNavActive, isTagActive, pickSidebarTags, type NavKey } from './nav';
import { useNavCounts, useTags } from './use-nav-counts';

export const NAV_ICON: Record<NavKey, typeof Inbox> = {
  today: CalendarDays,
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
        <div className="flex gap-1.5">
          <GuardedLink
            href="/notes/new"
            className={buttonVariants({ className: 'min-w-0 flex-1 justify-start' })}
          >
            <Plus aria-hidden />
            Note mới
          </GuardedLink>
          <CaptureButton />
        </div>
        <SearchButton />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {/* ?tag= cần useSearchParams: bọc Suspense để các trang tĩnh vẫn prerender được. */}
        <Suspense fallback={<SidebarBody pathname={pathname} tag={null} />}>
          <SidebarBodyWithParams pathname={pathname} />
        </Suspense>
      </div>
      {/* Xếp dọc: "Giao diện sáng" và "Đăng xuất" không vừa một hàng 216px với font Be Vietnam Pro. */}
      <div className="flex shrink-0 flex-col items-start gap-0.5 border-t border-sidebar-border p-3">
        <PendingLink />
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
  const { unsentCount } = useOutbox();
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
                count={
                  item.key === 'inbox' && counts.inbox !== undefined
                    ? counts.inbox + unsentCount
                    : counts[item.key]
                }
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

/** Nút trông như ô nhập: bấm thì mở bảng lệnh. Nhãn ⌘K/Ctrl K chỉ hiện sau khi hydrate. */
function SearchButton() {
  const { setPaletteOpen } = useCommands();
  const hydrated = useHydrated();
  const key = hydrated ? shortcutLabel('K', isMacPlatform(navigator.platform)) : null;
  return (
    <button
      type="button"
      onClick={() => setPaletteOpen(true)}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      className="mt-2 flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-field px-2.5 text-sm text-muted-foreground transition-colors hover:border-ring/70 hover:text-foreground pointer-coarse:h-10"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      Tìm kiếm…
      {key ? (
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[0.7rem]" aria-hidden>
          {key}
        </kbd>
      ) : null}
    </button>
  );
}

/** Nút ⚡ cạnh "Note mới": mở sheet ghi nhanh (phím C). */
function CaptureButton() {
  const { openCapture } = useCommands();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => openCapture()}
      aria-label="Ghi nhanh"
      aria-haspopup="dialog"
      aria-keyshortcuts="C"
      title="Ghi nhanh (C)"
    >
      <Zap />
    </Button>
  );
}

/**
 * Note chưa lên server, dẫn tới Inbox nơi có danh sách: "N note gửi lỗi" (đỏ, cần xử lý tay)
 * đứng trước "N note chờ gửi" (vàng, tự gửi lại). Chỉ hiện dòng có N > 0.
 */
function PendingLink() {
  const { pendingCount, failedCount } = useOutbox();
  const hydrated = useHydrated();
  if (!hydrated || pendingCount + failedCount === 0) return null;
  const link =
    'mb-1 inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-xs font-medium hover:underline pointer-coarse:py-2';
  return (
    <div className="flex flex-col items-start">
      {failedCount > 0 ? (
        <GuardedLink href="/inbox" className={cn(link, 'text-destructive')}>
          <CircleAlert className="size-3.5" aria-hidden />
          {failedCount} note gửi lỗi
        </GuardedLink>
      ) : null}
      {pendingCount > 0 ? (
        <GuardedLink href="/inbox" className={cn(link, 'text-warning')}>
          <CloudOff className="size-3.5" aria-hidden />
          {pendingCount} note chờ gửi
        </GuardedLink>
      ) : null}
    </div>
  );
}
