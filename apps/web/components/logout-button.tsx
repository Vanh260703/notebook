'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useGuardedAction } from '@/components/unsaved-guard';
import { errorMessage } from '@/lib/api/client';
import { logout } from '@/lib/api/auth';
import { cn } from '@/lib/utils';

/**
 * Đăng xuất (thao tác hiếm, cookie sống một năm): cuối sidebar trên desktop, cuối sheet "Thêm"
 * trên mobile, tách khỏi nút đổi theme để khỏi bấm nhầm. Còn thay đổi chưa lưu thì hỏi trước (qua guard).
 */
export function LogoutButton({ className }: { className?: string }) {
  const qc = useQueryClient();
  const guarded = useGuardedAction();
  const out = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      qc.clear();
      // Cố ý tải lại cả trang: xóa sạch state/cache trong bộ nhớ của phiên cũ.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => guarded(() => out.mutate())}
      disabled={out.isPending}
      className={cn('text-muted-foreground', className)}
    >
      <LogOut aria-hidden />
      Đăng xuất
    </Button>
  );
}
