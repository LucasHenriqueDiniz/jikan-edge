import type { FetchBudget } from '../../source/fetch-policy';
import type { SourceResult } from '../../source/source-types';

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
