import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

export default defineConfig({
  plugins: [cloudflareTest({
    miniflare: {
      compatibilityDate: '2026-10-16',
      compatibilityFlags: ['nodejs_compat'],
      d1Databases: ['DB'],
      bindings: { TEST_MIGRATIONS: await readD1Migrations('./migrations') },
    },
  })],
  test: { include: ['tests/**/*.test.ts'], setupFiles: ['./tests/setup.ts'], testTimeout: 20000 },
});
