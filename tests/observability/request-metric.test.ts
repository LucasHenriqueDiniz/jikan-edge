import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/app';
import { stubDatabase } from '../helpers/stub-database';

// The request metric is what Workers Logs counts. Until 2026-11-18 it said `cacheStatus: "miss"` and
// `stale: false` on every request, whatever the response said, so no hit or stale serve could be
// counted from the logs.

type Metric = { type: string; cacheStatus: string; stale: boolean; responseSizeBytes?: number };

function metricsDuring() {
  const lines: Metric[] = [];
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
    const parsed = typeof line === 'string' && line.startsWith('{') ? (JSON.parse(line) as Metric) : null;
    if (parsed?.type === 'operation_metric') lines.push(parsed);
  });
  return lines;
}

afterEach(() => vi.restoreAllMocks());

describe('the request metric', () => {
  it('repeats the X-Cache-Status the caller received', async () => {
    const metrics = metricsDuring();
    const response = await app.request('http://localhost/nope');

    expect(response.headers.get('x-cache-status')).toBe('error');
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({ cacheStatus: 'error', stale: false });
  });

  it('says unknown where the route set no status, not miss', async () => {
    const metrics = metricsDuring();
    await app.request('http://localhost/health', undefined, { DB: stubDatabase('ok') });

    expect(metrics[0].cacheStatus).toBe('unknown');
  });

  it('says rate_limited on a refused request', async () => {
    const metrics = metricsDuring();
    const refused = { limit: async () => ({ success: false }) };
    await app.request('http://localhost/health', undefined, { API_BURST_LIMIT: refused });

    expect(metrics[0]).toMatchObject({ cacheStatus: 'rate_limited', stale: false });
  });

  it('leaves the size out instead of logging 0 when no Content-Length was set', async () => {
    const metrics = metricsDuring();
    await app.request('http://localhost/nope');

    expect(metrics[0].responseSizeBytes).toBeUndefined();
  });
});
