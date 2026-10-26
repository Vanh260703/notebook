import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { readCookie } from '../../common/http/read-cookie';
import { SESSION_COOKIE, SessionService } from './session.service';

/** Guard toàn cục (APP_GUARD trong AuthModule). Route mở đánh dấu bằng @Public(). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly session: SessionService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    if (this.session.verify(readCookie(req.headers.cookie, SESSION_COOKIE)) !== null) return true;
    throw new UnauthorizedException({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Chưa đăng nhập',
    });
  }
}
