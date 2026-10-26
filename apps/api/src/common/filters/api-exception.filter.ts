import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody, ErrorCode } from '@notebook/shared';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { QueryFailedError } from 'typeorm';
import type { ZodError } from 'zod';

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_ATTEMPTS',
  501: 'NOT_IMPLEMENTED',
};

/** Mã lỗi Postgres do dữ liệu đầu vào sai (uuid/ngày/số không hợp lệ, tràn số). */
const PG_BAD_INPUT = new Set(['22P02', '22007', '22008', '22003']);
/** unique_violation, foreign_key_violation */
const PG_CONFLICT = new Set(['23505', '23503']);

type ErrorBody = ApiErrorBody & Record<string, unknown>;

/**
 * Mọi lỗi trả về dạng ApiError { statusCode, code, message, issues?, retryAfter? }.
 * Không bao giờ trả message của Postgres hay stack ra ngoài.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (res.headersSent) return;
    if (typeof body.retryAfter === 'number') res.setHeader('Retry-After', String(body.retryAfter));
    res.status(body.statusCode).json(body);
  }

  toBody(exception: unknown): ErrorBody {
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as ZodError | undefined;
      return {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Dữ liệu không hợp lệ',
        issues: (zodError?.issues ?? []).map((i) => ({
          path: i.path.map(String).join('.'),
          message: i.message,
        })),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (isObject(response) && typeof response.code === 'string') {
        return { ...response, statusCode: status } as ErrorBody;
      }
      return {
        statusCode: status,
        code: CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL' : 'BAD_REQUEST'),
        message: messageOf(response) ?? exception.message,
      };
    }

    // Lỗi từ body-parser của Express (JSON hỏng, body quá lớn) có `status`/`type`.
    if (
      isObject(exception) &&
      typeof exception.type === 'string' &&
      isHttpStatus(exception.status)
    ) {
      const status = exception.status;
      return {
        statusCode: status,
        code: CODE_BY_STATUS[status] ?? 'BAD_REQUEST',
        message:
          status === 413
            ? 'Nội dung gửi lên quá lớn'
            : exception.type === 'entity.parse.failed'
              ? 'Body JSON không hợp lệ'
              : 'Request không hợp lệ',
      };
    }

    if (exception instanceof QueryFailedError) {
      const pgCode = (exception as QueryFailedError & { code?: string }).code;
      if (pgCode && PG_BAD_INPUT.has(pgCode)) {
        return { statusCode: 400, code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ' };
      }
      if (pgCode && PG_CONFLICT.has(pgCode)) {
        return { statusCode: 409, code: 'CONFLICT', message: 'Xung đột dữ liệu, thử lại' };
      }
    }

    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL',
      message: 'Lỗi máy chủ',
    };
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isHttpStatus(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 400 && v < 600;
}

function messageOf(response: unknown): string | undefined {
  if (typeof response === 'string') return response;
  if (isObject(response)) {
    const m = response.message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.map(String).join('; ');
  }
  return undefined;
}
