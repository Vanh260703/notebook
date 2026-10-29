import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TodayView, TodayViewFallback } from './today-view';

export const metadata: Metadata = { title: 'Hôm nay · Notebook' };

export default function TodayPage() {
  return (
    // useSearchParams (?date=) cần Suspense để phần còn lại của trang vẫn prerender được.
    <Suspense fallback={<TodayViewFallback />}>
      <TodayView />
    </Suspense>
  );
}
