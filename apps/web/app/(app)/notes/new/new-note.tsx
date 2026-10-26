'use client';

import dynamic from 'next/dynamic';
import { NoteEditorSkeleton } from '@/components/notes/note-editor-skeleton';

/**
 * Không prerender: id (UUID) và entryDate (ngày theo giờ địa phương) phải sinh ở trình duyệt,
 * lúc mở trang. Prerender lúc build sẽ ra ngày build và lệch hydration.
 */
export const NewNote = dynamic(() => import('./new-note-form'), {
  ssr: false,
  loading: () => <NoteEditorSkeleton />,
});
