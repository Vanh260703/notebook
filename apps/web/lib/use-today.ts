'use client';

import { useSyncExternalStore } from 'react';
import { localDate } from './date';

const subscribe = (cb: () => void) => {
  const t = setInterval(cb, 60_000); // qua nửa đêm thì tự đổi ngày
  document.addEventListener('visibilitychange', cb);
  return () => {
    clearInterval(t);
    document.removeEventListener('visibilitychange', cb);
  };
};

/**
 * Ngày hôm nay theo giờ địa phương ('YYYY-MM-DD'), chỉ có ở client sau khi hydrate.
 * null khi render trên server/prerender (KHÔNG tính ngày lúc build). Snapshot là chuỗi nên
 * React so sánh bằng ===, không render thừa.
 */
export const useToday = (): string | null =>
  useSyncExternalStore(
    subscribe,
    () => localDate(),
    () => null,
  );
