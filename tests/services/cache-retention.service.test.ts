import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrunedBatch } from '../../src/ports/driven/catalog-store.port';
import { scheduled } from '../../src/scheduled';
import { CacheRetentionService, RETENTION_POLICY } from '../../src/services/cache-retention.service';
import { OVERLOADED } from '../helpers/stub-database';

const NOW = Date.parse('2026-11-16T12:00:00.000Z');

// A retention store that answers from a script: a number is a batch of that many cache entries
// (and as many payloads); an Error is a failure.
function scriptedStore(script: (number | Error)[]) {
  const cutoffs: string[] = [];
  const limits: number[] = [];
  const store = {
    async pruneExpiredBefore(cutoff: string, limit: number): Promise<PrunedBatch> {
      cutoffs.push(cutoff);
      limits.push(limit);
      const next = script[Math.min(cutoffs.length - 1, script.length - 1)];
      if (next instanceof Error) throw next;
      return { cacheEntries: next, payloads: next, databaseBytes: 4_000_000_000 - cutoffs.length };
    },
  };
  return { store, cutoffs, limits };
}

function recordingClock() {
  const slept: number[] = [];
  return { clock: { now: () => NOW, sleep: async (ms: number) => void slept.push(ms) }, slept };
}

describe('CacheRetentionService', () => {
  it('prunes what expired more than 14 days before now', async () => {
    const { store, cutoffs, limits } = scriptedStore([0]);
    await new CacheRetentionService(store, RETENTION_POLICY, recordingClock().clock).run();
    expect(cutoffs).toEqual(['2026-11-02T12:00:00.000Z']);
    expect(limits).toEqual([500]);
  });

  it('stops when a batch comes back short, pausing between batches', async () => {
    const { store, cutoffs } = scriptedStore([500, 500, 120]);
    const { clock, slept } = recordingClock();

    const report = await new CacheRetentionService(store, RETENTION_POLICY, clock).run();

    expect(cutoffs).toHaveLength(3);
    expect(slept).toEqual([1_000, 1_000]);
    expect(report).toMatchObject({ batches: 3, cacheEntries: 1_120, payloads: 1_120, stoppedBy: 'drained' });
    expect(report.databaseBytes).toBe(4_000_000_000 - 3);
  });

  it('stops at the cap while there is still more to prune', async () => {
    const { store, cutoffs } = scriptedStore([500]);
    const { clock, slept } = recordingClock();

    const report = await new CacheRetentionService(store, { ...RETENTION_POLICY, maxBatches: 4 }, clock).run();

    expect(cutoffs).toHaveLength(4);
    expect(slept).toHaveLength(3);
    expect(report).toMatchObject({ batches: 4, cacheEntries: 2_000, stoppedBy: 'cap' });
  });

  it('ends the run on the first failure instead of retrying it', async () => {
    const { store, cutoffs } = scriptedStore([500, new Error(OVERLOADED), 500]);

    const report = await new CacheRetentionService(store, RETENTION_POLICY, recordingClock().clock).run();

    expect(cutoffs).toHaveLength(2);
    expect(report).toMatchObject({ batches: 1, cacheEntries: 500, stoppedBy: 'error', error: OVERLOADED });
  });
});

describe('the scheduled entry point', () => {
  afterEach(() => vi.restoreAllMocks());

  // Nobody waits on the cron, so it must not spend the request path's 12 s retrying an overloaded
  // database: with the request policy this test would sit in retries until it timed out.
  it('gives up on an overloaded database at once and logs it as an error', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const refusing = {
      prepare: () => ({ bind: () => ({}) }),
      batch: async () => {
        throw new Error(OVERLOADED);
      },
    } as unknown as D1Database;

    const started = Date.now();
    await scheduled({} as ScheduledController, { DB: refusing } as never);

    expect(Date.now() - started).toBeLessThan(1_000);
    const logged = JSON.parse(errors.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ type: 'cache_retention', stoppedBy: 'error', batches: 0 });
  });

  it('skips the run on a deploy with no database bound', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await scheduled({} as ScheduledController, {} as never);
    expect(JSON.parse(warned.mock.calls[0][0] as string)).toMatchObject({ skipped: 'no D1 binding' });
  });
});
