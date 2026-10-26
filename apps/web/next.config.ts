import type { NextConfig } from 'next';

/**
 * Đích của rewrite /api/* (NestJS). Đây là chỗ DUY NHẤT dùng URL của API.
 * Dev: http://localhost:3001. Vercel: https://<máy>.<tailnet>.ts.net.
 * Lưu ý: rewrites được tính lúc build, nên trên Vercel phải đặt API_URL trước khi build.
 */
function apiUrl(): string {
  const raw = process.env.API_URL?.trim();
  if (!raw) {
    throw new Error(
      'Thiếu biến môi trường API_URL (đích proxy /api/* sang NestJS). ' +
        'Ví dụ khi dev: API_URL=http://localhost:3001 pnpm --filter web dev',
    );
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`API_URL không phải URL hợp lệ: "${raw}"`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`API_URL phải bắt đầu bằng http:// hoặc https://, nhận được "${raw}"`);
  }
  return raw.replace(/\/+$/, '');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    const target = apiUrl();
    return [{ source: '/api/:path*', destination: `${target}/:path*` }];
  },
};

export default nextConfig;
