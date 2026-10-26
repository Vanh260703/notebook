'use client';

import { Inbox, NotebookText, Plus, Tags, type LucideIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { GuardedLink } from '@/components/unsaved-guard';
import { cn } from '@/lib/utils';
import { MoreSheet } from './more-sheet';
import { TabIcon, tabItemClass } from './tab-item';
import { formatBadgeCount, isEditorRoute, isNavActive } from './nav';
import { useNavCounts } from './use-nav-counts';

/**
 * Điều hướng mobile (< md): 5 ô, nút "Note mới" ở giữa (vùng ngón cái).
 * GĐ2: [Hôm nay] [Ghi chú] [+] [Inbox] [Thêm], Tag chuyển vào sheet "Thêm".
 * Ẩn ở màn hình soạn note; ẩn khi bàn phím ảo mở (CSS trong globals.css, theo data-tabbar).
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const counts = useNavCounts();
  if (isEditorRoute(pathname)) return null;

  const tab = (href: string, label: string, icon: LucideIcon, active: boolean, badge?: number) => (
    <GuardedLink
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(tabItemClass, active && 'text-accent-foreground')}
    >
      <span className="relative">
        <TabIcon icon={icon} active={active} />
        {badge ? (
          <span
            aria-hidden
            className="absolute -top-1 right-0 h-4 min-w-4 rounded-full bg-status-inbox-bg px-1 text-center text-[0.6875rem] leading-4 font-bold text-status-inbox tabular-nums"
          >
            {formatBadgeCount(badge)}
          </span>
        ) : null}
      </span>
      {label}
      {badge ? <span className="sr-only">, {badge} note</span> : null}
    </GuardedLink>
  );

  return (
    <nav
      aria-label="Chính"
      data-tabbar
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar/95 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur-md md:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        <li>{tab('/notes', 'Ghi chú', NotebookText, isNavActive('notes', pathname))}</li>
        <li>{tab('/inbox', 'Inbox', Inbox, isNavActive('inbox', pathname), counts.inbox)}</li>
        <li className="grid place-items-center">
          <GuardedLink
            href="/notes/new"
            aria-label="Note mới"
            className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-elev-2 transition-colors hover:bg-primary-hover"
          >
            <Plus className="size-6" aria-hidden />
          </GuardedLink>
        </li>
        <li>{tab('/tags', 'Tag', Tags, isNavActive('tags', pathname))}</li>
        <li>
          <MoreSheet active={isNavActive('trash', pathname)} trashCount={counts.trash} />
        </li>
      </ul>
    </nav>
  );
}
