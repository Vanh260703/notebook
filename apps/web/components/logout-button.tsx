'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useOutbox } from '@/components/outbox/outbox-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useGuardedAction } from '@/components/unsaved-guard';
import { errorMessage } from '@/lib/api/client';
import { logout } from '@/lib/api/auth';
import { CAPTURE_HANDOFF_KEY, getSessionStorage } from '@/lib/capture-handoff';
import { clearAllDrafts, clearDraft } from '@/lib/local-draft';
import { cn } from '@/lib/utils';

/**
 * Đăng xuất (thao tác hiếm, cookie sống một năm): cuối sidebar trên desktop, cuối sheet "Thêm"
 * trên mobile, tách khỏi nút đổi theme để khỏi bấm nhầm. Còn thay đổi chưa lưu thì hỏi trước (qua guard).
 * Còn note chưa gửi lên server thì hỏi lại. Đăng xuất xong xóa outbox và mọi nháp trên máy này
 * (có thể là máy công ty).
 */
export function LogoutButton({ className }: { className?: string }) {
  const qc = useQueryClient();
  const guarded = useGuardedAction();
  const outbox = useOutbox();
  const [confirm, setConfirm] = useState(false);
  const stayRef = useRef<HTMLButtonElement>(null);
  const out = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      qc.clear();
      await outbox.clear().catch(() => undefined);
      try {
        clearAllDrafts(window.localStorage);
      } catch {
        // localStorage bị chặn: không có nháp nào
      }
      clearDraft(getSessionStorage(), CAPTURE_HANDOFF_KEY);
      // Cố ý tải lại cả trang: xóa sạch state/cache trong bộ nhớ của phiên cũ.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const start = () =>
    guarded(() => {
      if (outbox.pendingCount > 0) setConfirm(true);
      else out.mutate();
    });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={start}
        disabled={out.isPending}
        className={cn('text-muted-foreground', className)}
      >
        <LogOut aria-hidden />
        Đăng xuất
      </Button>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent showCloseButton={false} initialFocus={stayRef}>
          <DialogHeader>
            <DialogTitle>Còn {outbox.pendingCount} note chưa gửi lên server</DialogTitle>
            <DialogDescription>
              Đăng xuất sẽ xóa chúng khỏi máy này. Muốn giữ thì ở lại và đợi có mạng (xem ở Inbox).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button ref={stayRef} variant="outline" onClick={() => setConfirm(false)}>
              Ở lại
            </Button>
            <Button
              variant="destructive"
              disabled={out.isPending}
              onClick={() => {
                setConfirm(false);
                out.mutate();
              }}
            >
              Xóa và đăng xuất
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
