'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * false khi render trên server và trong lúc hydrate (kể cả Suspense boundary hydrate muộn), true sau đó.
 * Dùng cho dữ liệu chỉ có ở client (cache React Query): một boundary hydrate sau khi query đã có
 * dữ liệu sẽ render khác HTML của server và gây lỗi hydration (#418).
 */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
