/**
 * Unit test: không cần DB. Gồm src/**\/*.spec.ts và test/health.e2e-spec.ts (DataSource giả).
 * e2e với Postgres thật nằm trong test/db, chạy bằng `pnpm test:e2e` (jest.e2e.config.js).
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testRegex: '(src|test)/.*\\.(spec|e2e-spec)\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/test/db/'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
};
