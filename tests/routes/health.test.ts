import { describe, expect, it } from 'vitest';
import app from '../../src/app';
import type { Env } from '../../src/config/env';
import { stubDatabase } from '../helpers/stub-database';

async function health(env?: Partial<Env>) {
  const response = await app.request('http://localhost/health', undefined, env);
  return { status: response.status, body: (await response.json()) as { data: { status: string; checks: { database: string } } } };
}

describe('health route', () => {
  it('responds without storage', async () => {
    const { status, body } = await health();
    expect(status).toBe(200);
    expect(body.data.status).toBe('ok');
  });

  it('reports a usable database', async () => {
    expect((await health({ DB: stubDatabase('ok') })).body.data.checks.database).toBe('ok');
  });

  // The three ways a self-hosted deploy is broken, told apart in the body rather than left to the
  // operator to infer from 500s on every other route.
  it('names a database that was never migrated', async () => {
    expect((await health({ DB: stubDatabase('missing-schema') })).body.data.checks.database).toBe('not_migrated');
  });

  it('names a missing binding', async () => {
    expect((await health({})).body.data.checks.database).toBe('not_configured');
  });

  it('does not mistake an unreachable database for an un-migrated one', async () => {
    expect((await health({ DB: stubDatabase('unreachable') })).body.data.checks.database).toBe('unavailable');
  });

  // Uptime monitors watch this route; a degraded database must not read as the Worker being down.
  it('stays 200 while degraded', async () => {
    expect((await health({ DB: stubDatabase('missing-schema') })).status).toBe(200);
  });

  // /health is declared as taking no parameters in QUERY_CONTRACT, but its handler used to be
  // registered ahead of registerQueryGuards() — Hono's ordered composition meant the guard never
  // ran for this one route, and a bogus param silently answered 200 instead of 400.
  it('refuses a query parameter, like every other route', async () => {
    const response = await app.request('http://localhost/health?bogus=1', undefined, { DB: stubDatabase('ok') });
    expect(response.status).toBe(400);
    const { error } = (await response.json()) as { error: { code: string } };
    expect(error.code).toBe('UNKNOWN_PARAMETER');
  });
});
