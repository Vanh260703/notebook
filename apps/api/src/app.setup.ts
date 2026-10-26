import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

/** Giới hạn body JSON. Mặc định của Express chỉ 100 kB, note dài (dán log, code) sẽ bị 413. */
export const JSON_BODY_LIMIT = '1mb';

/**
 * Cấu hình HTTP dùng chung cho main.ts và e2e test (để test chạy đúng như production).
 * Phải gọi TRƯỚC app.init()/listen().
 */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  app.disable('x-powered-by');
  // Nest bỏ qua json parser mặc định khi đã đăng ký parser cùng loại ở đây.
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  // CDN của Vercel không bao giờ được cache response API (Set-Cookie, dữ liệu note).
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableShutdownHooks();
  return app;
}
