import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Một ô của tab bar: cả cột cao 64px là vùng chạm. */
export const tabItemClass =
  'flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground focus-visible:-outline-offset-2';

/** Pill chứa icon; sáng lên khi tab đang chọn. */
export function TabIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <span
      className={cn(
        'relative grid h-7 w-14 place-items-center rounded-full transition-colors duration-150',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      <Icon className="size-5" aria-hidden />
    </span>
  );
}
