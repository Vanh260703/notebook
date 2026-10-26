'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ApiError } from '@/lib/api/client';

export function Providers({ children }: { children: ReactNode }) {
  // Mỗi trình duyệt một QueryClient, tạo một lần (không tạo lại khi re-render).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Không thử lại lỗi 4xx (401/404 thử lại cũng vậy); lỗi mạng/5xx thử 1 lần.
            retry: (count, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
              count < 1,
          },
        },
      }),
  );
  return (
    // Mặc định tối; lựa chọn của người dùng lưu trong localStorage. Gắn class "dark" lên <html>.
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
