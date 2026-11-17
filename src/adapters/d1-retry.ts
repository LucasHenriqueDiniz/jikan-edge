import { StoreUnavailableError } from '../domain/errors';

/**
 * Retries the D1 failures that are the database's, not the statement's, inside the request that hit
 * them — and turns the ones that outlast the retries into a `StoreUnavailableError`.
 *
 * Why it exists (2026-11-16): a week of production answered 984 `500 INTERNAL_ERROR`, every one of
 * them `D1 DB is overloaded`. D1 runs one query at a time per database; when one runs long the queue
 * behind it fills and the rest are refused — on the cron run of that day the database executed
 * nothing from 03:07:23 to 03:07:37 UTC, and the request that arrived at 03:07:28 was refused in 9 ms
 * and never reached its cached row. The consumer that reported it does not retry anything but a 429,
 * so the retry has to happen here: waiting out a 15-second stall inside a 20-second client timeout is
 * the difference between a card and no card.
 *
 * What it does NOT retry is as deliberate as what it does. Only failures that prove the statement
 * never ran are retried: a request refused from the queue, or a database that failed to start. A
 * retry of those cannot apply a write twice, which matters for the one statement here that is not
 * idempotent (the conditional upsert that takes a refresh lease). `Network connection lost` is left
 * alone for that reason — a write can commit and still lose its answer — and so is every SQL error,
 * which is a bug a retry would only hide for twelve seconds.
 */
const NEVER_RAN = /D1 DB is overloaded|Internal error while starting up D1 DB storage/;

/**
 * D1 failures that are the platform's but may have happened mid-statement, so they are not retried —
 * only reported for what they are: the database being unavailable, not a bug in this code.
 *
 * Why (2026-11-16): from 19:30:43 to 19:31:28 UTC the production database executed nothing, and 88
 * requests failed in ~10 ms with `D1_ERROR: internal error; reference = <id>` — 88 different ids,
 * all answered `500 INTERNAL_ERROR`. Cloudflare's D1 documentation has no entry for that message (the
 * nearest is API code 7500, "a platform-side storage event made the database temporarily
 * unavailable"), and does not say whether a write that failed this way was applied, so retrying it
 * could take a refresh lease twice. A 45-second outage would also outlast any retry window.
 * `Internal error in D1 DB storage caused object to be reset` belongs here for the same reason: the
 * database restarted, possibly under a statement.
 */
const PLATFORM_FAILURE =
  /D1_ERROR: internal error; reference = |Internal error in D1 DB storage caused object to be reset/;

function failureText(error: unknown): string {
  if (!(error instanceof Error)) return '';
  const cause = error.cause instanceof Error ? error.cause.message : '';
  return `${error.message} ${cause}`;
}

export function isTransientD1Failure(error: unknown): boolean {
  return error instanceof Error && NEVER_RAN.test(failureText(error));
}

export function isD1PlatformFailure(error: unknown): boolean {
  return error instanceof Error && PLATFORM_FAILURE.test(failureText(error));
}

const unavailable = (error: unknown) =>
  new StoreUnavailableError(error instanceof Error ? error.message : String(error), { cause: error });

export interface D1RetryPolicy {
  /**
   * How long after the wrapper is built — the start of the request — a new retry may still begin.
   *
   * Counted from the request, not from the failure, because D1 can hold a statement in its queue for
   * a long time before answering. Measured against a blocked preview database on 2026-11-16: a read
   * waited ~21 s and succeeded, the write after it was refused, and a window counted from that refusal
   * retried it for another 12 s — the request answered after 32.4 s, where the code without retries
   * fell back to its stale copy at ~23 s. A late failure must not buy a fresh window.
   *
   * What no window can fix: a statement D1 keeps queued for ~20 s still costs ~20 s. That wait is
   * D1's, and it was there before the retry existed.
   */
  windowMs: number;
  baseDelayMs: number;
  maxDelayMs: number;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
}

// 12 s covers the stall measured on 2026-11-16 (the request was refused 9 ms after it arrived and the
// database came back 9.6 s later) with room for jitter, and still answers inside the consumer's
// 20-second timeout.
export const D1_RETRY_POLICY: D1RetryPolicy = {
  windowMs: 12_000,
  baseDelayMs: 200,
  maxDelayMs: 2_000,
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: () => Math.random(),
};

/**
 * Exponential backoff with equal jitter: half of each step is fixed, half is random. Full jitter can
 * draw a near-zero delay, and a burst of requests all retrying at once into a queue that is already
 * full is exactly the load D1 asks callers to spread out.
 */
export function backoffDelay(retry: number, policy: Pick<D1RetryPolicy, 'baseDelayMs' | 'maxDelayMs'>, random: number) {
  const step = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** retry);
  return Math.round(step / 2 + (step / 2) * random);
}

type Executor = <T>(operation: () => Promise<T>) => Promise<T>;

/**
 * A `D1Database` whose statements retry transient failures within one shared window.
 *
 * The window belongs to the wrapper, and the wrapper is built per request (see `D1CatalogStore`), so
 * it is the request's budget: it starts when the request does, every statement draws on the same
 * one, and once it is spent the next transient failure gives up at once. Without that, a request
 * making six statements against a flapping database could wait six windows.
 *
 * Proxies rather than a hand-written class so every member the repositories do not use today still
 * passes through untouched, and calls go to the real objects as their own `this` — the binding's
 * classes keep private state that a proxy receiver would not reach. `batch` is handed the real
 * statements back, because the binding does not accept anything else as one.
 */
export function retryingD1(db: D1Database, policy: D1RetryPolicy = D1_RETRY_POLICY): D1Database {
  const windowEnd = policy.now() + policy.windowMs;
  const execute: Executor = async (operation) => {
    let retries = 0;
    let waitedMs = 0;
    for (;;) {
      try {
        const result = await operation();
        if (retries > 0) console.warn(JSON.stringify({ type: 'd1_retry_recovered', retries, waitedMs }));
        return result;
      } catch (error) {
        if (isD1PlatformFailure(error)) throw unavailable(error);
        if (!isTransientD1Failure(error)) throw error;
        const delay = backoffDelay(retries, policy, policy.random());
        if (policy.now() + delay >= windowEnd) throw unavailable(error);
        await policy.sleep(delay);
        retries += 1;
        waitedMs += delay;
      }
    }
  };

  const originals = new WeakMap<object, D1PreparedStatement>();
  const statement = (real: D1PreparedStatement): D1PreparedStatement => {
    const wrapped = new Proxy(real, {
      get(target, property) {
        if (property === 'bind') return (...values: unknown[]) => statement(target.bind(...values));
        if (property === 'first' || property === 'all' || property === 'run' || property === 'raw') {
          const method = target[property] as (...args: unknown[]) => Promise<unknown>;
          return (...args: unknown[]) => execute(() => method.apply(target, args));
        }
        return passThrough(target, property);
      },
    });
    originals.set(wrapped, real);
    return wrapped;
  };

  return new Proxy(db, {
    get(target, property) {
      if (property === 'prepare') return (query: string) => statement(target.prepare(query));
      if (property === 'batch')
        return (statements: D1PreparedStatement[]) =>
          execute(() => target.batch(statements.map((each) => originals.get(each) ?? each)));
      return passThrough(target, property);
    },
  });
}

function passThrough(target: object, property: string | symbol): unknown {
  const value = Reflect.get(target, property, target);
  return typeof value === 'function' ? value.bind(target) : value;
}
