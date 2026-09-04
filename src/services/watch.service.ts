import type { RuntimeConfig } from '../config/env';
import { WATCH_PARSER_VERSION, type WatchEpisodeEntry, type WatchPromoEntry } from '../domain/watch';
import { parseWatchEpisodes } from '../parsers/watch-episodes.parser';
import { parseWatchPromos } from '../parsers/watch-promos.parser';
import type { CatalogSource } from '../ports/driven/catalog-source.port';
import type { CatalogStore } from '../ports/driven/catalog-store.port';
import { watchEpisodesUrl, watchPromosUrl } from '../source/mal-urls';
import { type CacheDeps, type ServiceResponse, sourceError, type WaitUntil, withCache } from './cacheable';

export class WatchService {
  private readonly deps: CacheDeps;
  private readonly catalog: CatalogStore['catalogLists'];
  constructor(
    store: CatalogStore,
    private readonly source: CatalogSource,
    private readonly config: RuntimeConfig,
    waitUntil?: WaitUntil,
  ) {
    this.deps = { cache: store.cacheEntries, locks: store.refreshLeases, waitUntil };
    this.catalog = store.catalogLists;
  }

  async episodes(popular: boolean, requestId: string): Promise<ServiceResponse<WatchEpisodeEntry[]>> {
    const cacheKey = `catalog:watch:episodes:${popular ? 'popular' : 'recent'}`;
    return withCache(
      this.deps,
      cacheKey,
      this.config.catalogTtlSeconds,
      WATCH_PARSER_VERSION,
      () => this.catalog.get<WatchEpisodeEntry[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(watchEpisodesUrl(popular), ['video-list']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = parseWatchEpisodes(source.value);
        const fetchedAt = new Date().toISOString();
        await this.catalog.put(cacheKey, value, fetchedAt, WATCH_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }

  async promos(popular: boolean, requestId: string): Promise<ServiceResponse<WatchPromoEntry[]>> {
    const cacheKey = `catalog:watch:promos:${popular ? 'popular' : 'recent'}`;
    return withCache(
      this.deps,
      cacheKey,
      this.config.catalogTtlSeconds,
      WATCH_PARSER_VERSION,
      () => this.catalog.get<WatchPromoEntry[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(watchPromosUrl(popular), ['js-fancybox-video']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = parseWatchPromos(source.value);
        const fetchedAt = new Date().toISOString();
        await this.catalog.put(cacheKey, value, fetchedAt, WATCH_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }
}
