'use client';

import { useEffect, useState } from 'react';

/** Giá trị trễ `ms` sau lần đổi cuối (dùng cho ô tìm của bảng lệnh). */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
