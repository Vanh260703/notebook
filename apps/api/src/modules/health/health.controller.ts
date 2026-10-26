import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { HealthResponse } from '@notebook/shared';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';

const DB_TIMEOUT_MS = 2000;

@Public()
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<HealthResponse> {
    if (await this.isDbUp()) {
      return { status: 'ok', db: 'up' };
    }
    const body: HealthResponse = { status: 'error', db: 'down' };
    throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
  }

  private async isDbUp(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS);
    });
    try {
      await Promise.race([this.dataSource.query('SELECT 1'), timeout]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
