import { describe, expect, it } from 'vitest';
import app from '../../src/app';
import { stubDatabase } from '../helpers/stub-database';

// `X-Worker-Version` used to be a var written by hand on 2026-07-19 and never changed again: every
// deploy since answered `jikan-edge-2026-07-19`, including the one that served the D1 incident of
// 2026-11-16 (`4f505cd5`). It now comes from the `version_metadata` binding, which the platform fills
// with the id of the version that is actually serving.
const VERSION: WorkerVersionMetadata = {
  id: '4cc1eafb-fcb4-4629-8b1e-37dd97a31029',
  tag: '',
  timestamp: '2026-11-17T01:43:26.000Z',
};

const refused = { limit: async () => ({ success: false }) } as unknown as RateLimit;

describe('X-Worker-Version', () => {
  it('carries the id of the deployed version', async () => {
    const response = await app.request('http://localhost/health', undefined, {
      DB: stubDatabase('ok'),
      CF_VERSION_METADATA: VERSION,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-worker-version')).toBe(VERSION.id);
  });

  it('carries it on a rate-limited answer too, which returns before the routes run', async () => {
    const response = await app.request('http://localhost/health', undefined, {
      DB: stubDatabase('ok'),
      API_BURST_LIMIT: refused,
      CF_VERSION_METADATA: VERSION,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('x-worker-version')).toBe(VERSION.id);
  });

  it('says local where no platform version exists', async () => {
    const response = await app.request('http://localhost/health', undefined, { DB: stubDatabase('ok') });

    expect(response.headers.get('x-worker-version')).toBe('local');
  });

  it('says local for the empty id that wrangler dev --remote binds', async () => {
    const response = await app.request('http://localhost/health', undefined, {
      DB: stubDatabase('ok'),
      CF_VERSION_METADATA: { id: '', tag: '', timestamp: '0001-01-01T00:00:00Z' },
    });

    expect(response.headers.get('x-worker-version')).toBe('local');
  });
});
