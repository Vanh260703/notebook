'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { isFocusRoute } from './nav';

/**
 * Vùng nội dung. Mobile: chừa chỗ cho tab bar dưới đáy, trừ màn hình soạn note và chế độ đọc
 * (tab bar ẩn).
 * `tabIndex={-1}`: đích của skip link. Không có header chung: mỗi trang tự có h1.
 */
export function AppMain({ children }: { children: ReactNode }) {
  const editor = isFocusRoute(usePathname());
  return (
    <main
      id="main"
      tabIndex={-1}
      className={cn(
        'min-w-0 flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] focus:outline-none md:px-8 md:py-6',
        editor ? 'pb-4' : 'pb-[calc(5rem+env(safe-area-inset-bottom))]',
      )}
    >
      {children}
    </main>
  );
}
