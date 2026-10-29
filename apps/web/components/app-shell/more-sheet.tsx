'use client';

import {
  CloudOff,
  Ellipsis,
  Moon,
  SquarePen,
  Sun,
  Tags,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { HealthStatus } from '@/components/health-status';
import { LogoutButton } from '@/components/logout-button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import { GuardedLink } from '@/components/unsaved-guard';
import { cn } from '@/lib/utils';
import { TabIcon, tabItemClass } from './tab-item';

/**
 * Ô "Thêm" của tab bar: bottom sheet (Dialog) chứa Note mới (trình soạn đầy đủ), Tag, Thùng rác,
 * số note chờ gửi, đổi giao diện, trạng thái server và Đăng xuất (cuối cùng, tách khỏi nút đổi theme).
 */
export function MoreSheet({
  active,
  trashCount,
  tagCount,
  pendingCount = 0,
}: {
  active: boolean;
  trashCount?: number;
  tagCount?: number;
  pendingCount?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-haspopup="dialog"
        className={cn(tabItemClass, active && 'text-accent-foreground')}
      >
        <TabIcon icon={Ellipsis} active={active} />
        Thêm
      </DialogTrigger>
      <DialogContent className="gap-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle>Thêm</DialogTitle>
        </DialogHeader>
        <MoreSheetBody
          onNavigate={() => setOpen(false)}
          trashCount={trashCount}
          tagCount={tagCount}
          pendingCount={pendingCount}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Chỉ render khi sheet mở (ở client), nên đọc resolvedTheme không lệch hydration. */
function MoreSheetBody({
  onNavigate,
  trashCount,
  tagCount,
  pendingCount,
}: {
  onNavigate: () => void;
  trashCount?: number;
  tagCount?: number;
  pendingCount: number;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <div className="flex flex-col">
      <SheetLink
        href="/notes/new"
        icon={SquarePen}
        label="Note mới (trình soạn đầy đủ)"
        onNavigate={onNavigate}
      />
      <SheetLink
        href="/tags"
        icon={Tags}
        label="Tag"
        count={tagCount}
        unit="tag"
        onNavigate={onNavigate}
      />
      <SheetLink
        href="/trash"
        icon={Trash2}
        label="Thùng rác"
        count={trashCount}
        unit="note"
        onNavigate={onNavigate}
      />
      <div className="flex h-12 items-center justify-between gap-3">
        <span className="text-base font-medium">Giao diện</span>
        <Segmented
          label="Giao diện"
          value={resolvedTheme === 'light' ? 'light' : 'dark'}
          onChange={setTheme}
          options={[
            { value: 'light', label: 'Sáng', icon: <Sun className="size-4" aria-hidden /> },
            { value: 'dark', label: 'Tối', icon: <Moon className="size-4" aria-hidden /> },
          ]}
        />
      </div>
      {pendingCount > 0 ? (
        <GuardedLink
          href="/inbox"
          onNavigate={onNavigate}
          className="-mx-2 flex h-12 items-center gap-3 rounded-lg px-2 text-base font-medium text-warning hover:bg-muted"
        >
          <CloudOff className="size-5" aria-hidden />
          {pendingCount} note chờ gửi
        </GuardedLink>
      ) : null}
      <HealthStatus className="-mx-1.5 self-start" />
      <div className="mt-2 border-t pt-2">
        <LogoutButton className="-mx-2 h-12 w-[calc(100%+1rem)] justify-start text-base pointer-coarse:h-12" />
      </div>
    </div>
  );
}

function SheetLink({
  href,
  icon: Icon,
  label,
  count,
  unit,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  unit?: string;
  onNavigate: () => void;
}) {
  return (
    <GuardedLink
      href={href}
      onNavigate={onNavigate}
      className="-mx-2 flex h-12 items-center gap-3 rounded-lg px-2 text-base font-medium hover:bg-muted"
    >
      <Icon className="size-5 text-muted-foreground" aria-hidden />
      {label}
      {count !== undefined ? (
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          <span className="sr-only">: </span>
          {count}
          <span className="sr-only"> {unit}</span>
        </span>
      ) : null}
    </GuardedLink>
  );
}
