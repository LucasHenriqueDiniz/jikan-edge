import { describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../src/app';

// Note what this file does NOT do: call applyD1Migrations. It runs against a real, empty D1 — the
// exact state of a self-hosted deploy that never ran `db:migrate:remote` (issue #1). The unit tests
// assert the same mapping against a stubbed error string; this one proves the string is real.
describe('an un-migrated database, against real D1', () => {
  it('answers 503 DATABASE_NOT_MIGRATED instead of a bare INTERNAL_ERROR', async () => {
    const response = await app.request('http://localhost/v1/anime/1', undefined, env);
    expect(response.status).toBe(503);
    expect((await response.json() as { error: { code: string } }).error.code).toBe('DATABASE_NOT_MIGRATED');
  });

  it('reports the same diagnosis on /health', async () => {
    const response = await app.request('http://localhost/health', undefined, env);
    expect((await response.json() as { data: { checks: { database: string } } }).data.checks.database).toBe('not_migrated');
  });
});
