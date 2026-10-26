import { Logger, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AUTH_CONFIG, type AuthConfig, parseAuthEnv } from '../../common/config/auth-env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginRateLimiter } from './login-rate-limiter';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_CONFIG,
      // Thiếu/sai biến thì throw ngay lúc NestFactory.create: process thoát với log rõ ràng.
      useFactory: (): AuthConfig => {
        const cfg = parseAuthEnv(process.env);
        if (!cfg.cookieSecure) {
          new Logger('AuthModule').warn(
            'COOKIE_SECURE=false: cookie đăng nhập không có thuộc tính Secure. Chỉ dùng khi dev qua http.',
          );
        }
        return cfg;
      },
    },
    AuthService,
    SessionService,
    LoginRateLimiter,
    // APP_GUARD khai báo ở module nào cũng áp dụng cho toàn app.
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [SessionService],
})
export class AuthModule {}
