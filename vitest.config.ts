import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // .mjs so the plain-Node setup script can be covered without tsc trying to type-check it.
    include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'],
    exclude: ['tests/integration/**'],
    environment: 'node',
  },
});
