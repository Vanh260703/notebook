import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { healthResponseSchema } from '@notebook/shared';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  async function createController(query: jest.Mock): Promise<HealthController> {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: getDataSourceToken(), useValue: { query } }],
    }).compile();
    return moduleRef.get(HealthController);
  }

  it('returns ok/up when SELECT 1 succeeds', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const controller = await createController(query);

    const result = await controller.check();

    expect(query).toHaveBeenCalledWith('SELECT 1');
    expect(healthResponseSchema.parse(result)).toEqual({ status: 'ok', db: 'up' });
  });

  it('throws 503 with error/down when the database fails', async () => {
    const query = jest.fn().mockRejectedValue(new Error('connection refused'));
    const controller = await createController(query);

    const error = await controller.check().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(503);
    expect((error as HttpException).getResponse()).toEqual({ status: 'error', db: 'down' });
  });
});
