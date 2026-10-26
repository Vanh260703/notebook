'use client';

import { Ellipsis, Moon, Sun, Trash2 } from 'lucide-react';
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
 * Ô "Thêm" của tab bar: bottom sheet (Dialog) chứa Thùng rác, đổi giao diện, trạng thái server
 * và Đăng xuất (cuối cùng, tách khỏi nút đổi theme).
 */
export function MoreSheet({ active, trashCount }: { active: boolean; trashCount?: number }) {
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
        <MoreSheetBody onNavigate={() => setOpen(false)} trashCount={trashCount} />
      </DialogContent>
    </Dialog>
  );
}

/** Chỉ render khi sheet mở (ở client), nên đọc resolvedTheme không lệch hydration. */
function MoreSheetBody({
  onNavigate,
  trashCount,
}: {
  onNavigate: () => void;
  trashCount?: number;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <div className="flex flex-col">
      <GuardedLink
        href="/trash"
        onNavigate={onNavigate}
        className="-mx-2 flex h-12 items-center gap-3 rounded-lg px-2 text-base font-medium hover:bg-muted"
      >
        <Trash2 className="size-5 text-muted-foreground" aria-hidden />
        Thùng rác
        {trashCount !== undefined ? (
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            <span className="sr-only">: </span>
            {trashCount}
            <span className="sr-only"> note</span>
          </span>
        ) : null}
      </GuardedLink>
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
      <HealthStatus className="-mx-1.5 self-start" />
      <div className="mt-2 border-t pt-2">
        <LogoutButton className="-mx-2 h-12 w-[calc(100%+1rem)] justify-start text-base pointer-coarse:h-12" />
      </div>
    </div>
  );
}
