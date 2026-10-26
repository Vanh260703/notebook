import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NotesView, NotesViewFallback } from '../notes/notes-view';

export const metadata: Metadata = { title: 'Inbox · Notebook' };

/** Note đang chờ sắp xếp (status INBOX). Dùng chung NotesView với trang Ghi chú. */
export default function InboxPage() {
  return (
    <Suspense fallback={<NotesViewFallback scope="inbox" />}>
      <NotesView scope="inbox" />
    </Suspense>
  );
}
