import type { ListNotesQuery } from '@notebook/shared';

export const qk = {
  me: ['auth', 'me'] as const,
  health: ['health'] as const,
  notes: ['notes'] as const,
  noteLists: ['notes', 'list'] as const,
  noteList: (q: ListNotesQuery) => ['notes', 'list', q] as const,
  note: (id: string) => ['notes', 'detail', id] as const,
  tags: ['tags'] as const,
  /** Số note theo ngày (lịch). Tạo/xóa/khôi phục/đổi entryDate đều làm số đổi. */
  days: ['days'] as const,
  dayRange: (from: string, to: string) => ['days', from, to] as const,
};
