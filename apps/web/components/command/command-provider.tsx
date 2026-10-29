'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface CaptureState {
  open: boolean;
  /** Ngày của note ('YYYY-MM-DD'); không có thì là hôm nay lúc bấm lưu. */
  date?: string;
}

export interface CommandState {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  capture: CaptureState;
  openCapture: (date?: string) => void;
  closeCapture: () => void;
}

const CommandContext = createContext<CommandState | null>(null);

/**
 * State mở/đóng của bảng lệnh (Ctrl/Cmd+K) và sheet ghi nhanh, dùng chung cho sidebar, tab bar,
 * phím tắt, bảng lệnh và trang Hôm nay.
 */
export function CommandProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [capture, setCapture] = useState<CaptureState>({ open: false });
  const value = useMemo<CommandState>(
    () => ({
      paletteOpen,
      setPaletteOpen,
      togglePalette: () => setPaletteOpen((o) => !o),
      capture,
      openCapture: (date) => {
        setPaletteOpen(false);
        setCapture({ open: true, date });
      },
      closeCapture: () => setCapture((c) => ({ ...c, open: false })),
    }),
    [paletteOpen, capture],
  );
  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}

export function useCommands(): CommandState {
  const ctx = useContext(CommandContext);
  if (!ctx) throw new Error('useCommands phải nằm trong CommandProvider');
  return ctx;
}
