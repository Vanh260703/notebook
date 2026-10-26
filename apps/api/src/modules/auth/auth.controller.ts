import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Session } from '@notebook/shared';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { readCookie } from '../../common/http/read-cookie';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';
import { LoginRateLimiter } from './login-rate-limiter';
import { SESSION_COOKIE, SessionService } from './session.service';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly session: SessionService,
    private readonly limiter: LoginRateLimiter,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Session {
    // Đang bị khóa thì KHÔNG kiểm tra mật khẩu, kể cả mật khẩu đúng.
    const retryAfter = this.limiter.retryAfterSeconds();
    if (retryAfter > 0) {
      throw new HttpException(
        {
          statusCode: 429,
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Sai mật khẩu quá nhiều lần, thử lại sau',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!this.auth.checkPassword(dto.password)) {
      this.limiter.recordFailure();
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'INVALID_PASSWORD',
        message: 'Sai mật khẩu',
      });
    }
    this.limiter.reset();
    const { value, expiresAt } = this.session.issue();
    res.cookie(SESSION_COOKIE, value, this.session.cookieOptions());
    return { authenticated: true, expiresAt };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.session.clearOptions());
  }

  /** Public, luôn 200: màn hình login không gặp 401 vô nghĩa. */
  @Get('me')
  me(@Req() req: Request): Session {
    const iat = this.session.verify(readCookie(req.headers.cookie, SESSION_COOKIE));
    return iat === null
      ? { authenticated: false, expiresAt: null }
      : { authenticated: true, expiresAt: this.session.expiresAt(iat) };
  }
}
