import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TrashView, TrashViewFallback } from './trash-view';

export const metadata: Metadata = { title: 'Thùng rác · Notebook' };

export default function TrashPage() {
  return (
    // ?page= đọc bằng useSearchParams: cần Suspense để phần còn lại vẫn prerender được.
    <Suspense fallback={<TrashViewFallback />}>
      <TrashView />
    </Suspense>
  );
}
