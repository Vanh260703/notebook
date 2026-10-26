/**
 * e2e với Postgres thật (TEST_DATABASE_URL). Chạy tuần tự: `pnpm --filter api test:e2e`.
 * setup-env.ts từ chối chạy nếu tên DB không kết thúc bằng _test (trừ khi CI=true).
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testRegex: 'test/db/.*\\.e2e-spec\\.ts$',
  setupFiles: ['<rootDir>/test/db/setup-env.ts'],
  testTimeout: 30_000,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
};
