import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Icon trang trí (đã aria-hidden), đứng trước chữ. */
  icon?: ReactNode;
};

/**
 * Nhóm nút chọn một (segmented control): `role="group"` + `aria-pressed`, không dùng tablist.
 * Dùng cho bộ lọc, loại/trạng thái trong editor, Viết/Xem và theme.
 * Chữ muted trên nền muted: 5.26:1 (sáng), 5.90:1 (tối).
 */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
  itemClassName,
}: {
  /** Tên của nhóm cho trình đọc màn hình. */
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex shrink-0 rounded-lg bg-muted p-0.5', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground pointer-coarse:h-9',
            'aria-pressed:bg-card aria-pressed:font-medium aria-pressed:text-foreground aria-pressed:shadow-elev-1',
            itemClassName,
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
