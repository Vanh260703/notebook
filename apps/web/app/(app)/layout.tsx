import type { ReactNode } from 'react';
import { AppMain } from '@/components/app-shell/app-main';
import { AppSidebar } from '@/components/app-shell/app-sidebar';
import { MobileTabBar } from '@/components/app-shell/mobile-tab-bar';
import { SkipLink } from '@/components/app-shell/skip-link';
import { UnsavedGuardProvider } from '@/components/unsaved-guard';

/**
 * Workspace: sidebar bên trái từ md (Thùng rác, tag, trạng thái server, Đăng xuất ở cuối),
 * tab bar dưới đáy trên mobile. Không có header chung.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <UnsavedGuardProvider>
      <SkipLink />
      <div className="flex min-h-dvh">
        <AppSidebar />
        <AppMain>{children}</AppMain>
      </div>
      <MobileTabBar />
    </UnsavedGuardProvider>
  );
}
