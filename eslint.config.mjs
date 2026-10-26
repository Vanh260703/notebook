// @ts-check
import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const WEB_FILES = ['apps/web/**/*.{js,jsx,mjs,ts,tsx}'];

/**
 * Chỉ áp các config của Next.js cho apps/web (mặc định chúng khớp mọi file **\/*.ts).
 * Các mục chỉ có `ignores` là global ignores, giữ nguyên.
 */
const scopeToWeb = (configs) =>
  configs.map((c) => {
    const isGlobalIgnore =
      c.ignores && Object.keys(c).every((k) => k === 'ignores' || k === 'name');
    return isGlobalIgnore ? c : { ...c, files: WEB_FILES };
  });

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      'apps/web/next-env.d.ts',
      // Migration do TypeORM sinh ra, không lint/format.
      'apps/api/src/database/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.{js,cjs}'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  ...scopeToWeb(nextVitals),
  {
    files: WEB_FILES,
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // App Router, không có thư mục pages/.
      '@next/next/no-html-link-for-pages': 'off',
      // Link phải đi qua guard thay đổi chưa lưu (chặn điều hướng khi note chưa lưu).
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/link',
              message:
                'Dùng GuardedLink từ @/components/unsaved-guard (chặn khi còn thay đổi chưa lưu).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/components/unsaved-guard.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: { ...globals.jest } },
  },
  prettier,
);
