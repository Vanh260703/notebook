'use client';

import { useEffect, useRef } from 'react';
import { useCommands } from '@/components/command/command-provider';
import { isTypingTarget } from '@/lib/command';

/**
 * Có dialog nào khác (không phải bảng lệnh) đang mở: guard, xung đột, sheet "Thêm"...
 * Bỏ qua dialog đang chạy animation đóng (base-ui gắn data-closed).
 */
const otherDialogOpen = () =>
  document.querySelector(
    ':is([role="dialog"], [role="alertdialog"]):not([data-command-palette]):not([data-closed])',
  ) !== null;

/**
 * Phím tắt toàn cục của app (gắn trong (app)/layout):
 * - Ctrl/Cmd+K: bật/tắt bảng lệnh, chạy cả khi đang gõ trong CodeMirror (listener ở pha capture,
 *   preventDefault để Chrome/Firefox không nhảy vào ô tìm của trình duyệt).
 * - C (không phím bổ trợ): mở ghi nhanh. Bỏ qua khi đang gõ trong ô nhập/CodeMirror.
 * Bỏ qua khi đang gõ IME và khi đang có dialog khác mở.
 */
export function GlobalShortcuts() {
  const commands = useCommands();
  const ref = useRef(commands);
  useEffect(() => {
    ref.current = commands;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      const key = e.key.toLowerCase();
      if (key === 'k' && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        const { paletteOpen, togglePalette } = ref.current;
        if (!paletteOpen && otherDialogOpen()) return;
        e.preventDefault();
        togglePalette();
        return;
      }
      if (
        key === 'c' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.shiftKey &&
        !e.repeat &&
        !isTypingTarget(document.activeElement as HTMLElement | null) &&
        !ref.current.paletteOpen &&
        !otherDialogOpen()
      ) {
        e.preventDefault();
        ref.current.openCapture();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return null;
}
