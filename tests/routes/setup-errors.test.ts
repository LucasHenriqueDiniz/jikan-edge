import { describe, expect, it } from 'vitest';
import app from '../../src/app';
import type { Env } from '../../src/config/env';
import { stubDatabase } from '../helpers/stub-database';

async function anime(env: Partial<Env>) {
  const response = await app.request('http://localhost/v1/anime/1', undefined, env);
  return { status: response.status, body: (await response.json()) as { error: { code: string; message: string } } };
}

// Reported as issue #1: a fresh self-hosted deploy answered INTERNAL_ERROR on all 96 routes, because
// every one of them reads `cache_entries` before doing anything else. The cause was never in the
// request — it was the deploy — so the response has to say which half of the setup is missing.
describe('setup failures on a self-hosted deploy', () => {
  it('says the database is not bound, instead of failing as an unexpected error', async () => {
    const { status, body } = await anime({});
    expect(status).toBe(503);
    expect(body.error.code).toBe('DATABASE_NOT_CONFIGURED');
    expect(body.error.message).toMatch(/wrangler\.jsonc/);
  });

  it('says the migrations were never applied, instead of failing as an unexpected error', async () => {
    const { status, body } = await anime({ DB: stubDatabase('missing-schema') });
    expect(status).toBe(503);
    expect(body.error.code).toBe('DATABASE_NOT_MIGRATED');
    expect(body.error.message).toMatch(/db:migrate:remote/);
  });

  // The narrow match matters: a genuine D1 outage is not an operator mistake, and telling someone to
  // re-run migrations they already ran sends them down the wrong path.
  it('keeps an unreachable database as an unexpected error', async () => {
    const { status, body } = await anime({ DB: stubDatabase('unreachable') });
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
