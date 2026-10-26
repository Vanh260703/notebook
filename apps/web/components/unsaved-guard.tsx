'use client';

// File DUY NHẤT được import next/link (ESLint no-restricted-imports, xem eslint.config.mjs).
// Nơi khác dùng GuardedLink.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createNavigationGuard,
  type GuardedForm,
  type NavigationGuard,
} from '@/lib/navigation-guard';

const GuardContext = createContext<NavigationGuard | null>(null);

/**
 * Chặn điều hướng trong app khi form còn thay đổi chưa lưu, hỏi Lưu rồi đi / Bỏ thay đổi / Ở lại.
 * Đặt ở app/(app)/layout.tsx. Ngoài provider (trang login) thì mọi thứ chạy như không có guard.
 */
export function UnsavedGuardProvider({ children }: { children: ReactNode }) {
  const [guard] = useState(createNavigationGuard);
  const pending = useSyncExternalStore(guard.subscribe, guard.isPending, () => false);
  const saving = useSyncExternalStore(guard.subscribe, guard.isSaving, () => false);
  const stayRef = useRef<HTMLButtonElement>(null);

  return (
    <GuardContext.Provider value={guard}>
      {children}
      <Dialog open={pending} onOpenChange={(open) => !open && void guard.resolve('stay')}>
        <DialogContent initialFocus={stayRef} showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Note còn thay đổi chưa lưu</DialogTitle>
            <DialogDescription>
              Rời trang bây giờ sẽ mất các thay đổi này. Lưu trước rồi đi tiếp?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button ref={stayRef} variant="outline" onClick={() => void guard.resolve('stay')}>
              Ở lại
            </Button>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={() => void guard.resolve('discard')}
            >
              Bỏ thay đổi
            </Button>
            <Button disabled={saving} onClick={() => void guard.resolve('save')}>
              {saving ? 'Đang lưu…' : 'Lưu rồi đi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GuardContext.Provider>
  );
}

/** Đăng ký form với guard. `form` có thể đổi mỗi render; guard luôn gọi bản mới nhất. */
export function useRegisterUnsavedForm(form: GuardedForm): void {
  const guard = useContext(GuardContext);
  const ref = useRef(form);
  useEffect(() => {
    ref.current = form;
  });
  useEffect(() => {
    if (!guard) return;
    return guard.register({
      isDirty: () => ref.current.isDirty(),
      save: () => ref.current.save(),
      discard: () => ref.current.discard(),
    });
  }, [guard]);
}

/** Chạy `action` qua guard (ví dụ đăng xuất). Không có provider thì chạy luôn. */
export function useGuardedAction(): (action: () => void) => void {
  const guard = useContext(GuardContext);
  return (action) => {
    if (guard) guard.attempt(action);
    else action();
  };
}

/** router.push/replace có hỏi trước khi bỏ thay đổi chưa lưu (dùng cho Ctrl+K ở GĐ2). */
export function useGuardedRouter() {
  const router = useRouter();
  const run = useGuardedAction();
  return {
    push: (href: string, options?: { scroll?: boolean }) => run(() => router.push(href, options)),
    replace: (href: string, options?: { scroll?: boolean }) =>
      run(() => router.replace(href, options)),
  };
}

type GuardedLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

/**
 * `next/link` có chặn khi còn thay đổi chưa lưu. Dùng `onNavigate` (chỉ chạy với điều hướng SPA,
 * nên Ctrl/Cmd+click mở tab mới vẫn bình thường).
 */
export function GuardedLink({ onNavigate, ...props }: GuardedLinkProps) {
  const guard = useContext(GuardContext);
  const router = useRouter();
  return (
    <Link
      {...props}
      onNavigate={(e) => {
        onNavigate?.(e);
        if (!guard) return;
        // Không có gì chưa lưu: attempt chạy callback ngay (bỏ qua), Link tự điều hướng.
        // Bị chặn: hủy điều hướng của Link; callback chạy sau khi người dùng chọn Lưu/Bỏ.
        let deferred = false;
        const allowed = guard.attempt(() => {
          if (!deferred) return;
          const opts = props.scroll === undefined ? undefined : { scroll: props.scroll };
          if (props.replace) router.replace(props.href, opts);
          else router.push(props.href, opts);
        });
        deferred = true;
        if (!allowed) e.preventDefault();
      }}
    />
  );
}
