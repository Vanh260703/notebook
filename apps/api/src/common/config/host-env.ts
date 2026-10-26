import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

const API_ENV = join(__dirname, '..', '..', '..', '.env'); // apps/api/.env
const ROOT_ENV = join(__dirname, '..', '..', '..', '..', '..', '.env'); // .env ở gốc repo

/**
 * Nạp env khi chạy trên host (start:dev, CLI migration, e2e). Trong container không có file .env nào
 * (.dockerignore loại hết), biến do docker compose truyền vào nên hàm này không làm gì.
 *
 * Ưu tiên: biến đã có sẵn (CI, shell) > apps/api/.env > .env gốc. Secret chỉ nằm ở .env gốc,
 * dùng chung với docker compose; apps/api/.env chỉ chứa giá trị riêng cho host.
 * Ghi thẳng vào process.env thay vì process.loadEnvFile: Jest cấp cho mỗi file test một bản sao
 * process.env, loadEnvFile chỉ ghi vào bản gốc.
 */
export function loadHostEnv(): void {
  for (const file of [API_ENV, ROOT_ENV]) {
    if (!existsSync(file)) continue;
    for (const [k, v] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
      if (process.env[k] === undefined && v !== undefined) process.env[k] = v;
    }
  }
  const url = hostDatabaseUrl(process.env, 'notebook');
  if (process.env.DATABASE_URL === undefined && url) process.env.DATABASE_URL = url;
}

/** URL tới Postgres của docker compose (port mở ra 127.0.0.1 bởi docker-compose.dev.yml). */
export function hostDatabaseUrl(env: NodeJS.ProcessEnv, db: string): string | undefined {
  if (!env.POSTGRES_PASSWORD) return undefined;
  const port = env.POSTGRES_HOST_PORT || '5432';
  return `postgresql://notebook:${encodeURIComponent(env.POSTGRES_PASSWORD)}@127.0.0.1:${port}/${db}`;
}
