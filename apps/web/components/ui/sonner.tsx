'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react';

/**
 * Toast theo token của app (không dùng richColors: bảng màu riêng của sonner lệch với token).
 * Màu chỉ nằm ở icon. Vị trí dưới phải; ở mobile nằm trên tab bar (biến --toast-offset-bottom
 * trong globals.css đổi theo breakpoint md, vì mobile của sonner là ≤ 600px còn tab bar là < 768px).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-primary-ink" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'calc(var(--radius) * 1.4)',
        } as React.CSSProperties
      }
      position="bottom-right"
      offset={{ bottom: 'var(--toast-offset-bottom)', right: '1.5rem' }}
      mobileOffset={{ bottom: 'var(--toast-offset-bottom)' }}
      toastOptions={{
        classNames: {
          toast: 'cn-toast rounded-xl! shadow-elev-3! font-sans!',
          // Nút "Hoàn tác"
          actionButton: 'bg-primary! text-primary-foreground! rounded-md! font-medium!',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
