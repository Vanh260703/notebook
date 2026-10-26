import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { CreateNoteInput } from '@notebook/shared';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { LoginRateLimiter } from '../../src/modules/auth/login-rate-limiter';
import { TEST_PASSWORD } from './constants';

export interface TestContext {
  app: NestExpressApplication;
  /** Request chưa đăng nhập. */
  http: () => ReturnType<typeof request>;
  /** Agent đã đăng nhập (giữ cookie). */
  agent: ReturnType<typeof request.agent>;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/** Dựng AppModule thật (migrationsRun tự chạy), cấu hình HTTP giống main.ts. */
export async function createTestApp(
  customize: (b: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<TestContext> {
  const moduleRef = await customize(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: ['error', 'warn'],
  });
  configureApp(app);
  await app.init();

  const server = app.getHttpServer();
  const dataSource = app.get(DataSource);
  const limiter = app.get(LoginRateLimiter);
  const agent = request.agent(server);

  return {
    app,
    http: () => request(server),
    agent,
    reset: async () => {
      await dataSource.query('TRUNCATE "NoteTag", "Note", "Tag"');
      limiter.reset();
      await agent.post('/auth/login').send({ password: TEST_PASSWORD }).expect(200);
    },
    close: () => app.close(),
  };
}

export function newNote(over: Partial<CreateNoteInput> = {}): CreateNoteInput {
  return {
    id: randomUUID(),
    entryDate: '2026-10-26',
    title: 'Tiêu đề',
    content: 'Nội dung',
    ...over,
  };
}
