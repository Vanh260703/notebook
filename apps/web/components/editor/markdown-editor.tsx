'use client';

import dynamic from 'next/dynamic';

/** CodeMirror không SSR được (cần DOM); tải riêng một bundle ở client. */
export const MarkdownEditor = dynamic(() => import('./codemirror-editor'), {
  ssr: false,
  loading: () => (
    <div className="p-3 text-sm text-muted-foreground" aria-busy="true">
      Đang tải editor…
    </div>
  ),
});
