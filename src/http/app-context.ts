import type { Context, Hono } from 'hono';
import type { Env } from '../config/env';
import type { WaitUntil } from '../services/cacheable';
import type { Freshness } from './caching';
import { cacheControlFor } from './caching';

export type Variables = { requestId: string; startedAt: number; page: number };
export type App = Hono<{ Bindings: Env; Variables: Variables }>;
export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

// Lets a service finish a refresh after its response is sent, which is what turns the request that
// trips a TTL from the one that pays the multi-second upstream cost into one that is served the
// stale row immediately, like every request arriving beside it already was.
//
// `c.executionCtx` throws when there is no ExecutionContext — `app.request()` in the tests does not
// supply one. Returning undefined there is deliberate: `withCache` falls back to refreshing inline,
// which is the behaviour that existed before this, so tests stay deterministic rather than racing a
// promise nothing is waiting on.
export function background(c: AppContext): WaitUntil | undefined {
  try {
    const ctx = c.executionCtx;
    return (promise) => ctx.waitUntil(promise);
  } catch {
    return undefined;
  }
}

// `X-Cache-Status` describes what *this* Worker did. `Cache-Control` tells everything downstream —
// browsers, CDNs, the caller's own HTTP client — how long the answer stays good, which nothing
// could know before: every response was previously uncacheable by omission, so a client polling a
// route re-downloaded an identical body every time.
//
// max-age is the freshness that REMAINS, not the full TTL: a resource fetched five hours into a
// six-hour TTL has one hour left, and advertising six would let a cache serve it five hours after
// it went stale here. A stale response advertises 0, so the next request revalidates.
//
// stale-while-revalidate lets a shared cache keep serving during a refresh, which matches how this
// API already behaves internally and spares callers the multi-second upstream wait.
export function cacheHeader(c: AppContext, result: Freshness & { cached: boolean }): void {
  c.header('X-Cache-Status', result.stale ? 'stale' : result.cached ? 'hit' : 'miss');
  const cacheControl = cacheControlFor(result);
  if (cacheControl) c.header('Cache-Control', cacheControl);
}
