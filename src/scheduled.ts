import { D1CatalogStore } from './adapters/d1-catalog-store';
import { D1_RETRY_POLICY } from './adapters/d1-retry';
import type { Env } from './config/env';
import { CacheRetentionService } from './services/cache-retention.service';

/**
 * The Worker's cron entry point (`triggers.crons` in `wrangler.jsonc`): the cache retention run.
 *
 * The store is built with a zero retry window. The request path retries an overloaded D1 because a
 * caller is waiting; here nobody is, and the right answer to an overloaded database is to stop and let
 * the next run try — so the first refusal ends the run (CacheRetentionService treats any error so).
 */
export async function scheduled(_controller: ScheduledController, env: Env): Promise<void> {
  if (!env.DB) {
    console.warn(JSON.stringify({ type: 'cache_retention', skipped: 'no D1 binding' }));
    return;
  }
  const store = new D1CatalogStore(env.DB, { ...D1_RETRY_POLICY, windowMs: 0 });
  const report = await new CacheRetentionService(store.retention).run();
  const log = report.stoppedBy === 'error' ? console.error : console.log;
  log(JSON.stringify({ type: 'cache_retention', ...report }));
}
