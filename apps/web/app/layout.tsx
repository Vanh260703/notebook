import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import './globals.css';

// Be Vietnam Pro: thiết kế riêng cho dấu tiếng Việt chồng tầng. Không có bản variable nên liệt kê
// weight; không tải italic (preview dùng nghiêng giả của trình duyệt).
const sans = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

// Chỉ dùng ở editor/code/kbd: không preload để trang danh sách không phải chờ.
// (Fira Code không có subset vietnamese, nên không dùng.)
const mono = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-jetbrains',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'Notebook',
  description: 'Sổ tay học tập & cá nhân',
};

// Chrome Android: bàn phím ảo mở thì co layout lại (thanh Lưu dính trên cùng vẫn nằm trong màn hình).
// viewportFit cover: để env(safe-area-inset-*) có giá trị trên iOS (tab bar, thanh dính).
// Không đặt maximumScale/userScalable: chặn người dùng tự phóng to là vi phạm WCAG 1.4.4.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // next-themes gắn class "dark" lên <html> trước khi React hydrate.
    <html
      lang="vi"
      className={cn('font-sans', sans.variable, mono.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
