/**
 * What came back from one fetch, in terms the caller can act on. Declared here rather than in
 * `src/source/` because the port owns its contract — the adapter imports this, not the other way
 * round. Living beside the adapter made this the one port in the tree pointing outward at its own
 * implementation's directory; `CacheEntry` was moved into the store port for exactly this reason
 * and these two were left behind.
 *
 * `SourceResult` is what keeps the boundary honest: no upstream `Response`, status code or header
 * reaches a service. The non-success kinds are the vocabulary `sourceError()` maps to HTTP.
 */
export interface SourceMetadata {
  url: string;
  status: number | null;
  contentType: string | null;
  durationMs: number;
  sizeBytes: number;
}

export type SourceResult<T> =
  | { kind: 'success'; value: T; metadata: SourceMetadata }
  | {
      kind: 'not_found' | 'private' | 'rate_limited' | 'suspicious' | 'upstream_error' | 'timeout';
      reason?: string;
      metadata: SourceMetadata;
    };

/**
 * The timeout and size ceiling one call is allowed. The *type* belongs to the port — it is a
 * parameter of `getHtml`. The budgets themselves are policy and stay in
 * `src/source/fetch-policy.ts`, measured against real pages.
 */
export interface FetchBudget {
  timeoutMs: number;
  maxBytes: number;
}

/**
 * The catalog-source conversation: fetch the document behind a catalog URL, and say in domain terms
 * what came back.
 *
 * Named for the conversation, not for MyAnimeList — see
 * [the ADR](../../../docs/architecture/adr-ports-for-driven-dependencies.md). `MalClient` is the one
 * adapter today; tests pass their own.
 *
 * The method keeps the adapter's `getHtml` name rather than something layer-neutral like
 * `fetchDocument`. Renaming it is 11 service call sites and their tests for no change in behaviour,
 * and this repo does scrape HTML — the name is accurate, not a leak. `SourceResult` is what actually
 * keeps the boundary honest: no upstream `Response`, status code or header reaches a service.
 *
 * `requiredMarkers` are strings the document must contain to count as `success`; without them a
 * challenge or error page classifies as a good fetch and the parser fails downstream instead.
 * `budget` overrides the per-request timeout and size ceiling for the pages known to be slow or
 * large (the character tables).
 */
export interface CatalogSource {
  getHtml(url: string, requiredMarkers?: string[], budget?: Partial<FetchBudget>): Promise<SourceResult<string>>;
}
