import 'reflect-metadata';
import { join } from 'node:path';
import pg from 'pg';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { loadHostEnv } from '../common/config/host-env';
import { Note } from '../modules/notes/note.entity';
import { Tag } from '../modules/tags/tag.entity';

// Khi chạy trên host (CLI migration, start:dev) thì đọc apps/api/.env và .env gốc.
loadHostEnv();
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL chưa được đặt (cần POSTGRES_PASSWORD trong .env gốc)');
}

// Cột "date" trả về chuỗi 'YYYY-MM-DD' thay vì Date (tránh lệch múi giờ).
pg.types.setTypeParser(pg.types.builtins.DATE, (v: string) => v);

const isTs = __filename.endsWith('.ts');

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Note, Tag],
  // Không dùng {.ts,.js}: glob đó khớp cả file .d.ts.
  migrations: [join(__dirname, 'migrations', isTs ? '*.ts' : '*.js')],
  synchronize: false,
  uuidExtension: 'pgcrypto',
  installExtensions: false,
  // 'schema': TypeORM 1.x ghi log "Migration ... executed successfully" ở mức schema, không phải migration.
  logging: ['error', 'warn', 'migration', 'schema'],
  // KHÔNG đặt migrationsRun ở đây.
};

export default new DataSource(dataSourceOptions);
