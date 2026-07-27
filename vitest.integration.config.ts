import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [cloudflareTest(async () => ({
    wrangler: { configPath: './wrangler.jsonc' },
    miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations(path.join(__dirname, 'migrations')) } },
  }))],
  test: { include: ['tests/integration/**/*.test.ts'] },
});
