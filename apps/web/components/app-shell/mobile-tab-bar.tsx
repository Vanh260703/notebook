'use client';

import { CalendarDays, Inbox, NotebookText, Plus, type LucideIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCommands } from '@/components/command/command-provider';
import { useOutbox } from '@/components/outbox/outbox-provider';
import { GuardedLink } from '@/components/unsaved-guard';
import { cn } from '@/lib/utils';
import { MoreSheet } from './more-sheet';
import { TabIcon, tabItemClass } from './tab-item';
import { formatBadgeCount, isFocusRoute, isNavActive } from './nav';
import { useNavCounts } from './use-nav-counts';

/**
 * Điều hướng mobile (< md): [Hôm nay] [Ghi chú] [+ Ghi nhanh] [Inbox] [Thêm], nút giữa trong vùng
 * ngón cái mở sheet ghi nhanh. Note mới đầy đủ, Tag, Thùng rác nằm trong sheet "Thêm".
 * Badge Inbox = note INBOX trên server + note chờ gửi.
 * Ẩn ở màn hình soạn note; ẩn khi bàn phím ảo mở (CSS trong globals.css, theo data-tabbar).
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const counts = useNavCounts();
  const { openCapture } = useCommands();
  const { pendingCount } = useOutbox();
  if (isFocusRoute(pathname)) return null;
  const inboxBadge = counts.inbox === undefined ? undefined : counts.inbox + pendingCount;

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
        <li>{tab('/today', 'Hôm nay', CalendarDays, isNavActive('today', pathname))}</li>
        <li>{tab('/notes', 'Ghi chú', NotebookText, isNavActive('notes', pathname))}</li>
        <li className="grid place-items-center">
          <button
            type="button"
            onClick={() => openCapture()}
            aria-label="Ghi nhanh"
            aria-haspopup="dialog"
            className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-elev-2 transition-colors hover:bg-primary-hover"
          >
            <Plus className="size-6" aria-hidden />
          </button>
        </li>
        <li>{tab('/inbox', 'Inbox', Inbox, isNavActive('inbox', pathname), inboxBadge)}</li>
        <li>
          <MoreSheet
            active={isNavActive('trash', pathname) || isNavActive('tags', pathname)}
            trashCount={counts.trash}
            tagCount={counts.tags}
            pendingCount={pendingCount}
          />
        </li>
      </ul>
    </nav>
  );
}
