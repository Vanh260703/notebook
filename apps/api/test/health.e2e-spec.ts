import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { HealthModule } from '../src/modules/health/health.module';

// HTTP thật qua Express, DataSource giả: kiểm tra route, status code và body JSON.
describe('GET /health (e2e)', () => {
  let app: INestApplication;
  const query = jest.fn();

  // Thay cho TypeOrmModule: cung cấp DataSource giả cho toàn app.
  @Global()
  @Module({
    providers: [{ provide: getDataSourceToken(), useValue: { query } }],
    exports: [getDataSourceToken()],
  })
  class FakeDatabaseModule {}

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDatabaseModule, HealthModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('200 {"status":"ok","db":"up"}', async () => {
    query.mockResolvedValueOnce([{ '?column?': 1 }]);
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('503 {"status":"error","db":"down"}', async () => {
    query.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await request(app.getHttpServer()).get('/health').expect(503);
    expect(res.body).toEqual({ status: 'error', db: 'down' });
  });
});
