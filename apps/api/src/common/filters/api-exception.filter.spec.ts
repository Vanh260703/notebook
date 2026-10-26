import {
  BadRequestException,
  Logger,
  ConflictException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { apiErrorSchema } from '@notebook/shared';
import { ZodValidationException } from 'nestjs-zod';
import { QueryFailedError } from 'typeorm';
import { z } from 'zod';
import { ApiExceptionFilter } from './api-exception.filter';

const pgError = (code: string) =>
  new QueryFailedError('SELECT 1', [], Object.assign(new Error('pg secret detail'), { code }));

describe('ApiExceptionFilter.toBody', () => {
  const filter = new ApiExceptionFilter();
  // Không in log lỗi 500 khi chạy test.
  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

  it('maps ZodValidationException to 400 VALIDATION_FAILED with issue paths', () => {
    const err = z.object({ tags: z.array(z.string()) }).safeParse({ tags: [1] }).error;
    const body = filter.toBody(new ZodValidationException(err));
    expect(apiErrorSchema.parse(body)).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      issues: [{ path: 'tags.0' }],
    });
  });

  it('passes through HttpException bodies that already have a code', () => {
    const body = filter.toBody(
      new ConflictException({
        statusCode: 409,
        code: 'VERSION_CONFLICT',
        message: 'x',
        current: 1,
      }),
    );
    expect(body).toEqual({ statusCode: 409, code: 'VERSION_CONFLICT', message: 'x', current: 1 });
  });

  it('derives a code for plain HttpExceptions', () => {
    expect(filter.toBody(new NotFoundException('Cannot GET /x'))).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Cannot GET /x',
    });
    expect(filter.toBody(new BadRequestException()).code).toBe('BAD_REQUEST');
    expect(filter.toBody(new PayloadTooLargeException()).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('maps body-parser errors', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      type: 'entity.too.large',
    });
    expect(filter.toBody(tooLarge)).toMatchObject({ statusCode: 413, code: 'PAYLOAD_TOO_LARGE' });
    const badJson = Object.assign(new SyntaxError('Unexpected token'), {
      status: 400,
      type: 'entity.parse.failed',
    });
    expect(filter.toBody(badJson)).toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });
  });

  it('maps Postgres errors without leaking their message', () => {
    expect(filter.toBody(pgError('22P02'))).toEqual({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Dữ liệu không hợp lệ',
    });
    expect(filter.toBody(pgError('23505'))).toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    expect(filter.toBody(pgError('23503'))).toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    const internal = filter.toBody(pgError('42P01'));
    expect(internal).toEqual({ statusCode: 500, code: 'INTERNAL', message: 'Lỗi máy chủ' });
  });

  it('maps unknown errors to 500 INTERNAL', () => {
    expect(filter.toBody(new Error('boom'))).toEqual({
      statusCode: 500,
      code: 'INTERNAL',
      message: 'Lỗi máy chủ',
    });
  });
});
