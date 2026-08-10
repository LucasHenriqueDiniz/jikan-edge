import { describe, expect, it } from 'vitest';
import app from '../../src/app';
import type { Env } from '../../src/config/env';

function dbWithRow(payload: unknown): D1Database {
  const statement = { bind: () => statement, first: async () => ({ payload_json: JSON.stringify(payload) }), run: async () => ({ meta: {}, success: true }), all: async () => ({ results: [] }) };
  return { prepare: () => statement } as unknown as D1Database;
}

// meta was `{}` on these four routes while every other one of the API's ~90 routes includes
// requestId — a consumer correlating logs via body.meta.requestId got undefined here, silently.
describe('random routes', () => {
  it('includes requestId in meta, like every other route', async () => {
    const env = { DB: dbWithRow({ malId: 1, title: 'Cowboy Bebop' }) } as Partial<Env>;
    const response = await app.request('http://localhost/v1/random/anime', undefined, env);
    const body = (await response.json()) as { data: unknown; meta: { requestId?: string } };
    expect(response.status).toBe(200);
    expect(body.meta.requestId).toEqual(expect.any(String));
    expect(body.data).toEqual({ malId: 1, title: 'Cowboy Bebop' });
  });

  it('does the same for manga, characters and people', async () => {
    for (const kind of ['manga', 'characters', 'people']) {
      const env = { DB: dbWithRow({ malId: 1 }) } as Partial<Env>;
      const response = await app.request(`http://localhost/v1/random/${kind}`, undefined, env);
      const body = (await response.json()) as { meta: { requestId?: string } };
      expect(body.meta.requestId).toEqual(expect.any(String));
    }
  });
});
