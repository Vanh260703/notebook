import type { NoteStatus, NoteType } from '@notebook/shared';

export const TYPE_LABEL: Record<NoteType, string> = {
  LEARNING: 'Học tập',
  PERSONAL: 'Cá nhân',
};

export const STATUS_LABEL: Record<NoteStatus, string> = {
  INBOX: 'Inbox',
  ACTIVE: 'Đang dùng',
  ARCHIVED: 'Lưu trữ',
};
