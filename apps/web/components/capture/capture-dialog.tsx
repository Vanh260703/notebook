'use client';

import { useCommands } from '@/components/command/command-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatShortDay, localDate } from '@/lib/date';
import { CaptureComposer } from './capture-composer';

/** Sheet "Ghi nhanh" (bottom sheet trên mobile). Mở từ tab bar, sidebar, phím C, bảng lệnh. */
export function CaptureDialog() {
  const { capture, closeCapture } = useCommands();
  const other = capture.date && capture.date !== localDate();
  return (
    <Dialog open={capture.open} onOpenChange={(o) => !o && closeCapture()}>
      <DialogContent className="gap-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Ghi nhanh{other ? <> vào {formatShortDay(capture.date!)}</> : null}
          </DialogTitle>
        </DialogHeader>
        <CaptureComposer date={capture.date} autoFocus onDone={closeCapture} />
      </DialogContent>
    </Dialog>
  );
}
