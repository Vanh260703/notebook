import { hostDatabaseUrl, loadHostEnv } from '../../src/common/config/host-env';
import { TEST_PASSWORD, TEST_SESSION_SECRET } from './constants';

// Chạy trước khi import AppModule, một lần cho mỗi file test.
// Không ghi đè biến đã có (biến của CI thắng).
loadHostEnv();

const url = process.env.TEST_DATABASE_URL ?? hostDatabaseUrl(process.env, 'notebook_test');
if (!url) {
  throw new Error(
    'Thiếu TEST_DATABASE_URL hoặc POSTGRES_PASSWORD trong .env gốc. e2e cần Postgres thật.',
  );
}
const dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
// Test TRUNCATE mọi bảng: không bao giờ chạy trên DB dev.
if (!dbName.endsWith('_test') && process.env.CI !== 'true') {
  throw new Error(
    `Từ chối chạy e2e trên DB "${dbName}": tên DB phải kết thúc bằng _test (hoặc đặt CI=true).`,
  );
}

process.env.DATABASE_URL = url;
process.env.APP_PASSWORD = TEST_PASSWORD;
process.env.SESSION_SECRET = TEST_SESSION_SECRET;
// supertest.agent không gửi cookie Secure qua http. Thuộc tính Secure được test riêng.
process.env.COOKIE_SECURE = 'false';
