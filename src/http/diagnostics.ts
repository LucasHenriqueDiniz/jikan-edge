// A fresh self-hosted deploy fails in two ways that have nothing to do with the request being made:
// no D1 bound to the Worker, or a D1 that exists but was never migrated. Both used to surface as a
// generic INTERNAL_ERROR on every one of the 96 routes, because every route reads `cache_entries`
// before anything else — see docs/self-hosting.md and issue #1.

export type DatabaseStatus = 'ok' | 'not_configured' | 'not_migrated' | 'unavailable';

/**
 * D1 reports a missing schema as `D1_ERROR: no such table: cache_entries: SQLITE_ERROR`. Matching the
 * message is the only signal available — D1 does not expose a structured error code. Deliberately
 * narrow: a broader match (e.g. any TypeError) would blame the operator's config for code bugs.
 */
export function isMissingSchema(error: unknown): boolean {
  return /no such table/i.test(error instanceof Error ? error.message : String(error ?? ''));
}

/** Cheapest possible read against the one table every route depends on. */
export async function probeDatabase(db: D1Database | undefined): Promise<DatabaseStatus> {
  if (!db) return 'not_configured';
  try {
    await db.prepare('SELECT 1 FROM cache_entries LIMIT 1').first();
    return 'ok';
  } catch (error) {
    return isMissingSchema(error) ? 'not_migrated' : 'unavailable';
  }
}

export const SETUP_HINT: Record<'not_configured' | 'not_migrated', string> = {
  not_configured:
    'No D1 database is bound to this Worker. Set d1_databases[0].database_id in wrangler.jsonc — run "npm run setup", or see docs/self-hosting.md.',
  not_migrated: 'The bound D1 database has no schema. Run "npm run db:migrate:remote" — see docs/self-hosting.md.',
};
