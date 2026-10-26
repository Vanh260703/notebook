import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NotesView, NotesViewFallback } from './notes-view';

export const metadata: Metadata = { title: 'Ghi chú · Notebook' };

export default function NotesPage() {
  return (
    // useSearchParams cần Suspense boundary để phần còn lại của trang vẫn prerender được.
    <Suspense fallback={<NotesViewFallback />}>
      <NotesView />
    </Suspense>
  );
}
