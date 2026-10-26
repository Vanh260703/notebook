'use client';

import { CircleAlert, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError, errorMessage } from '@/lib/api/client';

/**
 * Lỗi tải dữ liệu, nằm lại trên trang (không chỉ toast). Lỗi mạng (`status 0`) có lời nhắn riêng:
 * server ở nhà có thể đang tắt.
 */
export function QueryError({
  error,
  onRetry,
  title = 'Không tải được danh sách',
}: {
  error: unknown;
  onRetry: () => void;
  title?: string;
}) {
  const network = error instanceof ApiError && error.status === 0;
  const Icon = network ? WifiOff : CircleAlert;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4"
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{network ? 'Không kết nối được server' : title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {network ? 'Server ở nhà có thể đang tắt hoặc mất mạng.' : errorMessage(error)}
        </p>
        <Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw aria-hidden />
          Thử lại
        </Button>
      </div>
    </div>
  );
}
