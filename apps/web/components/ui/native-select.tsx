import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * <select> gốc của trình duyệt, cùng kiểu với Input (dùng tốt trên mobile, không cần JS).
 * Chữ 16px dưới md: iOS Safari tự phóng to trang khi focus ô có chữ nhỏ hơn 16px.
 * Popup tối/sáng theo `color-scheme` trong globals.css.
 */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'h-8 rounded-lg border border-input bg-field px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:bg-muted disabled:opacity-50 pointer-coarse:h-10 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}
