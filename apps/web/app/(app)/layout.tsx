import type { ReactNode } from 'react';
import { AppMain } from '@/components/app-shell/app-main';
import { AppSidebar } from '@/components/app-shell/app-sidebar';
import { GlobalShortcuts } from '@/components/app-shell/global-shortcuts';
import { MobileTabBar } from '@/components/app-shell/mobile-tab-bar';
import { SkipLink } from '@/components/app-shell/skip-link';
import { CaptureDialog } from '@/components/capture/capture-dialog';
import { CommandPalette } from '@/components/command/command-palette';
import { CommandProvider } from '@/components/command/command-provider';
import { OutboxProvider } from '@/components/outbox/outbox-provider';
import { UnsavedGuardProvider } from '@/components/unsaved-guard';

/**
 * Workspace: sidebar bên trái từ md (Thùng rác, tag, trạng thái server, Đăng xuất ở cuối),
 * tab bar dưới đáy trên mobile. Không có header chung.
 * Bảng lệnh Ctrl/Cmd+K nằm trong guard: điều hướng từ đó vẫn hỏi khi còn thay đổi chưa lưu.
 * Outbox (note mới chờ gửi) chỉ có trong app, không có ở trang login.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <UnsavedGuardProvider>
      <OutboxProvider>
        <CommandProvider>
          <SkipLink />
          <div className="flex min-h-dvh">
            <AppSidebar />
            <AppMain>{children}</AppMain>
          </div>
          <MobileTabBar />
          <GlobalShortcuts />
          <CommandPalette />
          <CaptureDialog />
        </CommandProvider>
      </OutboxProvider>
    </UnsavedGuardProvider>
  );
}
