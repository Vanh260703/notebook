import { NotebookPen } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Đăng nhập · Notebook' };

/** Form một ô căn giữa (quy ước quen thuộc), glow indigo nhẹ ở trên. */
export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 py-10 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(40rem_28rem_at_50%_0%,var(--glow),transparent_70%)]">
      <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-elev-2">
            <NotebookPen className="size-6" aria-hidden />
          </span>
          <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.02em]">Notebook</h1>
          <p className="text-sm text-muted-foreground">Sổ tay học tập & cá nhân</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
