import type { RuntimeConfig } from '../config/env';
import { WATCH_PARSER_VERSION, type WatchEpisodeEntry, type WatchPromoEntry } from '../domain/watch';
import { parseWatchEpisodes } from '../parsers/watch-episodes.parser';
import { parseWatchPromos } from '../parsers/watch-promos.parser';
import { CacheRepository } from '../repositories/cache.repository';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import { MalClient } from '../source/mal-client';
import { watchEpisodesUrl, watchPromosUrl } from '../source/mal-urls';
import { type CacheDeps, type ServiceResponse, sourceError, type WaitUntil, withCache } from './cacheable';

export class WatchService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly deps: CacheDeps;
  private readonly catalog: CatalogListRepository;
  private readonly source: MalClient;
  constructor(private readonly db: D1Database, private readonly config: RuntimeConfig, source?: MalClient, waitUntil?: WaitUntil) {
    this.cache = new CacheRepository(db); this.locks = new RefreshLockRepository(db); this.deps = { cache: this.cache, locks: this.locks, waitUntil }; this.catalog = new CatalogListRepository(db); this.source = source ?? new MalClient(config);
  }

  async episodes(popular: boolean, requestId: string): Promise<ServiceResponse<WatchEpisodeEntry[]>> {
    const cacheKey = `catalog:watch:episodes:${popular ? 'popular' : 'recent'}`;
    return withCache(this.deps, cacheKey, this.config.catalogTtlSeconds, WATCH_PARSER_VERSION, () => this.catalog.get<WatchEpisodeEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(watchEpisodesUrl(popular), ['video-list']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseWatchEpisodes(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, WATCH_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async promos(popular: boolean, requestId: string): Promise<ServiceResponse<WatchPromoEntry[]>> {
    const cacheKey = `catalog:watch:promos:${popular ? 'popular' : 'recent'}`;
    return withCache(this.deps, cacheKey, this.config.catalogTtlSeconds, WATCH_PARSER_VERSION, () => this.catalog.get<WatchPromoEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(watchPromosUrl(popular), ['js-fancybox-video']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseWatchPromos(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, WATCH_PARSER_VERSION);
      return value;
    }, requestId);
  }
}
