'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Eye, EyeOff } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSession, login } from '@/lib/api/auth';
import { errorMessage, isApiError } from '@/lib/api/client';
import { qk } from '@/lib/query-keys';

/** Chỉ cho chuyển về đường dẫn nội bộ (chặn open redirect kiểu ?next=//evil.com). */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\'))
    return '/notes';
  if (raw === '/login' || raw.startsWith('/login?')) return '/notes';
  return raw;
}

function loginErrorText(e: unknown): string {
  if (isApiError(e, 'INVALID_PASSWORD')) return 'Sai mật khẩu.';
  if (isApiError(e, 'TOO_MANY_ATTEMPTS')) {
    const s = typeof e.body.retryAfter === 'number' ? e.body.retryAfter : 0;
    return `Sai quá nhiều lần. Thử lại sau ${Math.max(1, Math.ceil(s / 60))} phút.`;
  }
  return errorMessage(e);
}

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = safeNext(sp.get('next'));
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Đã đăng nhập (cookie hợp lệ) thì đi tiếp luôn.
  const me = useQuery({ queryKey: qk.me, queryFn: getSession, retry: false });
  useEffect(() => {
    if (me.data?.authenticated) router.replace(next);
  }, [me.data, next, router]);

  const mutation = useMutation({
    mutationFn: () => login({ password }),
    onSuccess: (session) => {
      qc.setQueryData(qk.me, session);
      router.replace(next);
    },
    onError: () => setPassword(''),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!password || mutation.isPending) return;
    mutation.mutate();
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-elev-2"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          Mật khẩu
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={mutation.isError ? true : undefined}
            aria-describedby={mutation.isError ? 'login-error' : undefined}
            className="h-11 pr-11 text-base pointer-coarse:h-11 md:text-base"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-pressed={showPassword}
            aria-label="Hiện mật khẩu"
            title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground active:not-aria-[haspopup]:-translate-y-1/2"
          >
            {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </Button>
        </div>
        {mutation.isError ? (
          <p
            id="login-error"
            role="alert"
            className="flex items-center gap-1.5 text-sm text-destructive"
          >
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {loginErrorText(mutation.error)}
          </p>
        ) : null}
      </div>
      <Button
        type="submit"
        className="h-11 w-full pointer-coarse:h-11"
        disabled={!password || mutation.isPending}
      >
        {mutation.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </Button>
    </form>
  );
}
