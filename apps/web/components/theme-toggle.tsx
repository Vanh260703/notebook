'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Đổi sáng/tối. Icon và chữ đổi bằng class dark: (CSS), không đọc theme lúc render, nên không lệch
 * hydration. `withLabel`: nút có chữ (sidebar); phần bị ẩn bằng CSS không vào tên truy cập.
 */
export function ThemeToggle({ withLabel, className }: { withLabel?: boolean; className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const toggle = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  if (withLabel) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        className={cn('text-muted-foreground', className)}
      >
        <Sun className="hidden dark:block" aria-hidden />
        <Moon className="dark:hidden" aria-hidden />
        <span className="hidden dark:inline">Giao diện sáng</span>
        <span className="dark:hidden">Giao diện tối</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Đổi giao diện sáng/tối"
      title="Đổi giao diện sáng/tối"
      onClick={toggle}
      className={className}
    >
      <Sun className="hidden dark:block" aria-hidden />
      <Moon className="dark:hidden" aria-hidden />
    </Button>
  );
}
