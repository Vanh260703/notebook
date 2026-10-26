import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { dataSourceOptions } from './database/data-source';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { NotesModule } from './modules/notes/notes.module';
import { TagsModule } from './modules/tags/tags.module';

@Module({
  imports: [
    // migrationsRun chỉ bật ở app, không đặt trong data-source.ts (CLI sẽ âm thầm chạy migration).
    TypeOrmModule.forRoot({ ...dataSourceOptions, migrationsRun: true }),
    AuthModule, // đăng ký SessionGuard toàn cục (APP_GUARD)
    HealthModule,
    NotesModule,
    TagsModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
