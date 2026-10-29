import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { BACKOFF_MAX_MS, backoffMs, classifyError, errorInfo } from './classify';

const err = (status: number, code = 'X') =>
  new ApiError(status, { statusCode: status, code, message: 'm' });

describe('classifyError', () => {
  it('network, timeout, rate limit, 5xx and race CONFLICT are transient', () => {
    for (const e of [err(0, 'NETWORK'), err(408), err(429), err(500), err(502), err(503)]) {
      expect(classifyError(e)).toBe('transient');
    }
    expect(classifyError(err(409, 'CONFLICT'))).toBe('transient');
    expect(classifyError(new TypeError('Failed to fetch'))).toBe('transient');
  });

  it('401 is auth', () => {
    expect(classifyError(err(401, 'UNAUTHORIZED'))).toBe('auth');
  });

  it('other 4xx and VERSION_CONFLICT are permanent', () => {
    for (const e of [
      err(400, 'VALIDATION_FAILED'),
      err(413),
      err(404),
      err(409, 'VERSION_CONFLICT'),
    ]) {
      expect(classifyError(e)).toBe('permanent');
    }
  });
});

describe('backoffMs', () => {
  it('5, 10, 20, 40, 80, 160 s then capped at 5 minutes', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(backoffMs)).toEqual([
      5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000,
    ]);
    expect(backoffMs(50)).toBe(BACKOFF_MAX_MS);
  });
});

describe('errorInfo', () => {
  it('keeps status/code/message of ApiError, NETWORK otherwise', () => {
    expect(errorInfo(err(400, 'VALIDATION_FAILED'))).toEqual({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'm',
    });
    expect(errorInfo(new Error('boom'))).toEqual({ status: 0, code: 'NETWORK', message: 'boom' });
  });
});
