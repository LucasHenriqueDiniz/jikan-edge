// Every status a ServiceError is actually constructed with, across direct `new ServiceError(...)`
// call sites and sourceError's upstream-kind mapping. Narrowed from `number` so errors.ts can hand
// `error.status` straight to Hono's `c.json` without a cast that told the type system every
// ServiceError is a 400 — which a typed client generated from this app (Hono's `hc<AppType>()`)
// would have taken literally.
export type ServiceErrorStatus = 400 | 403 | 404 | 429 | 501 | 502 | 503 | 504 | 507;

/**
 * The failure a caller is allowed to see: a stable code, the status it maps to, and a message
 * written for whoever reads the response.
 *
 * It lives in the domain rather than beside `withCache` because the domain throws it —
 * `pagination.ts` rejects a page number here, long before any caching decision exists — and a
 * domain file importing from the application layer was the one arrow in this tree pointing outward.
 * Nothing about the class needed caching to exist; it was only ever declared next to it.
 */
export class ServiceError extends Error {
  /** Seconds the caller should wait before trying again, sent as `Retry-After` when present. */
  public readonly retryAfterSeconds?: number;

  constructor(
    public readonly code: string,
    public readonly status: ServiceErrorStatus,
    message: string,
    options?: { retryAfterSeconds?: number },
  ) {
    super(message);
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

/**
 * The store could not answer, for a reason that is the store's and not the request's: the database
 * stayed overloaded or restarting for longer than one request is allowed to wait, or failed with an
 * internal error of its own.
 *
 * The store adapter throws it once its own retries are spent, so the HTTP layer can tell a passing
 * outage (503, retry later) from a bug (500). It is an error of its own rather than a ServiceError
 * because the store raises it, not a use case, and because the caller is owed a `Retry-After` that a
 * code and a status cannot carry. Measured on 2026-11-16: 984 production 500s in a week, every one a
 * `D1 DB is overloaded` that answered `INTERNAL_ERROR` — indistinguishable from a bug.
 */
export class StoreUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StoreUnavailableError';
  }
}
