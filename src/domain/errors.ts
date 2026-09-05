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
  constructor(
    public readonly code: string,
    public readonly status: ServiceErrorStatus,
    message: string,
  ) {
    super(message);
  }
}
