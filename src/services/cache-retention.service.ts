import type { CatalogStore, PrunedBatch } from '../ports/driven/catalog-store.port';

/**
 * How the cleanup is paced. Measured on the preview database (2026-11-16): one batch of 500 keys
 * costs ~6 ms of SQL across both deletes, and 1,000 rows give back ~1.15 MB. The pause and the cap
 * are not about that cost — they keep the cleanup from sitting in D1's single queue for long stretches
 * while live requests wait behind it: 30 batches with a second between them is ~30 s of wall time
 * every ten minutes, with the database free in between.
 *
 * 14 days of retention: an entry is refreshed whenever it is requested after it expires, so one that
 * expired 14 days ago has not been served fresh in two weeks. What is lost by deleting it is a stale
 * copy to fall back on when MyAnimeList is down, for something nobody has asked for since.
 */
export const RETENTION_POLICY = {
  keepExpiredDays: 14,
  batchSize: 500,
  maxBatches: 30,
  pauseMs: 1_000,
};

export type RetentionPolicy = typeof RETENTION_POLICY;

export interface RetentionClock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const REAL_CLOCK: RetentionClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface RetentionReport {
  cutoff: string;
  batches: number;
  cacheEntries: number;
  payloads: number;
  databaseBytes: number | null;
  /** `drained`: a batch came back short, nothing older is left. `cap`: maxBatches reached. */
  stoppedBy: 'drained' | 'cap' | 'error';
  error?: string;
}

/**
 * One cleanup run: prune in bounded batches, oldest first, until a batch comes back short or the
 * cap is reached. Any failure ends the run instead of being retried — the next run is ten minutes
 * away, and a database that is refusing work is the last thing a cleanup should add load to.
 *
 * The loop is bounded by attempts, not by successful batches. Counting only successes, a database
 * that refused every call would be asked forever, once a second; this was found by a mutant that
 * dropped the early exit on failure and hung the test instead of failing it.
 */
export class CacheRetentionService {
  constructor(
    private readonly store: CatalogStore['retention'],
    private readonly policy: RetentionPolicy = RETENTION_POLICY,
    private readonly clock: RetentionClock = REAL_CLOCK,
  ) {}

  async run(): Promise<RetentionReport> {
    const cutoff = new Date(this.clock.now() - this.policy.keepExpiredDays * 86_400_000).toISOString();
    const report: RetentionReport = {
      cutoff,
      batches: 0,
      cacheEntries: 0,
      payloads: 0,
      databaseBytes: null,
      stoppedBy: 'cap',
    };
    for (let attempt = 0; attempt < this.policy.maxBatches; attempt += 1) {
      if (attempt > 0) await this.clock.sleep(this.policy.pauseMs);
      let batch: PrunedBatch;
      try {
        batch = await this.store.pruneExpiredBefore(cutoff, this.policy.batchSize);
      } catch (error) {
        report.stoppedBy = 'error';
        report.error = error instanceof Error ? error.message : String(error);
        return report;
      }
      report.batches += 1;
      report.cacheEntries += batch.cacheEntries;
      report.payloads += batch.payloads;
      report.databaseBytes = batch.databaseBytes;
      if (batch.cacheEntries < this.policy.batchSize) {
        report.stoppedBy = 'drained';
        return report;
      }
    }
    return report;
  }
}
