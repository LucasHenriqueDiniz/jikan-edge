import type { RuntimeConfig } from '../config/env';
import type { ExternalLink } from '../domain/anime';
import { PRODUCER_PARSER_VERSION, type ProducerDetail } from '../domain/producer';
import { PRODUCER_FULL_PARSER_VERSION, type ProducerFull } from '../domain/producer-full';
import { parseProducerDetail } from '../parsers/producer-detail.parser';
import { parseProducerFull } from '../parsers/producer-full.parser';
import { PRODUCER_LIST_PARSER_VERSION, type ProducerListEntry } from '../domain/producer-list';
import { parseProducersList } from '../parsers/producers-list.parser';
import type { CatalogSource } from '../ports/driven/catalog-source.port';
import type { CatalogStore } from '../ports/driven/catalog-store.port';
import { producerDetailUrl, producersIndexUrl } from '../source/mal-urls';
import {
  type CacheDeps,
  ServiceError,
  type ServiceResponse,
  sourceError,
  type WaitUntil,
  withCache,
} from './cacheable';

export class ProducerService {
  private readonly cache: CatalogStore['cacheEntries'];
  private readonly deps: CacheDeps;
  private readonly producers: CatalogStore['producers'];
  private readonly catalog: CatalogStore['catalogLists'];
  constructor(
    store: CatalogStore,
    private readonly source: CatalogSource,
    private readonly config: RuntimeConfig,
    waitUntil?: WaitUntil,
  ) {
    this.cache = store.cacheEntries;
    this.deps = { cache: store.cacheEntries, locks: store.refreshLeases, waitUntil };
    this.producers = store.producers;
    this.catalog = store.catalogLists;
  }

  private validateMalId(rawId: string): number {
    const malId = Number.parseInt(rawId, 10);
    if (!Number.isInteger(malId) || malId <= 0 || String(malId) !== rawId)
      throw new ServiceError('INVALID_PRODUCER_ID', 400, 'Producer id is invalid.');
    return malId;
  }

  async list(rawQuery: string | undefined, requestId: string): Promise<ServiceResponse<ProducerListEntry[]>> {
    const cacheKey = 'catalog:producers';
    const result = await withCache(
      this.deps,
      cacheKey,
      this.config.catalogTtlSeconds,
      PRODUCER_LIST_PARSER_VERSION,
      () => this.catalog.get<ProducerListEntry[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(producersIndexUrl(), ['genre-name-link']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = parseProducersList(source.value);
        await this.catalog.put(cacheKey, value, new Date().toISOString(), PRODUCER_LIST_PARSER_VERSION);
        return value;
      },
      requestId,
    );
    const query = (rawQuery ?? '').trim().toLowerCase();
    return query
      ? { ...result, data: result.data.filter((entry) => entry.name.toLowerCase().includes(query)) }
      : result;
  }

  async detail(rawId: string, requestId: string): Promise<ServiceResponse<ProducerDetail>> {
    const malId = this.validateMalId(rawId);
    return withCache(
      this.deps,
      `producer:${malId}:detail`,
      this.config.animeTtlSeconds,
      PRODUCER_PARSER_VERSION,
      () => this.producers.get(malId),
      async () => {
        const source = await this.source.getHtml(producerDetailUrl(malId), ['title-name']);
        if (source.kind !== 'success') throw sourceError(source);
        const fetchedAt = new Date().toISOString();
        const detail = parseProducerDetail(source.value, malId, fetchedAt);
        await this.producers.put(detail, fetchedAt, PRODUCER_PARSER_VERSION);
        await this.primeFullCache(malId, source.value, fetchedAt);
        return detail;
      },
      requestId,
    );
  }

  full(rawId: string, requestId: string): Promise<ServiceResponse<ProducerFull>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:producer:${malId}:full`;
    return withCache(
      this.deps,
      cacheKey,
      this.config.animeTtlSeconds,
      PRODUCER_FULL_PARSER_VERSION,
      () => this.catalog.get<ProducerFull>(cacheKey),
      async () => {
        const source = await this.source.getHtml(producerDetailUrl(malId), ['title-name']);
        if (source.kind !== 'success') throw sourceError(source);
        const fetchedAt = new Date().toISOString();
        const full = parseProducerFull(source.value, malId, fetchedAt);
        await this.catalog.put(cacheKey, full, fetchedAt, PRODUCER_FULL_PARSER_VERSION);
        await this.primeDetailCache(malId, full, fetchedAt);
        return full;
      },
      requestId,
    );
  }

  async external(rawId: string, requestId: string): Promise<ServiceResponse<ExternalLink[]>> {
    const result = await this.full(rawId, requestId);
    return { ...result, data: result.data.external };
  }

  // detail() and full() read the exact same MAL page. Same fix as AnimeService: whichever one
  // actually refreshes also writes the other's cache row from the HTML already in hand, so a
  // near-simultaneous call to the other doesn't cost a second real upstream fetch. Best-effort —
  // a priming failure must not fail the request that triggered it.
  private async primeFullCache(malId: number, html: string, fetchedAt: string): Promise<void> {
    try {
      const full = parseProducerFull(html, malId, fetchedAt);
      const cacheKey = `catalog:producer:${malId}:full`;
      await this.catalog.put(cacheKey, full, fetchedAt, PRODUCER_FULL_PARSER_VERSION);
      await this.primeCacheEntry(cacheKey, PRODUCER_FULL_PARSER_VERSION, fetchedAt);
    } catch (error) {
      console.warn(
        JSON.stringify({ type: 'cache_priming_failed', resource: 'producer_full', malId, error: String(error) }),
      );
    }
  }

  private async primeDetailCache(malId: number, full: ProducerFull, fetchedAt: string): Promise<void> {
    try {
      // ProducerFull is ProducerDetail plus about/external — strip them before writing to the
      // plain detail cache, or /v1/producers/:id would leak fields only /full ever promised.
      const { about: _about, external: _external, ...detail } = full;
      await this.producers.put(detail, fetchedAt, PRODUCER_PARSER_VERSION);
      await this.primeCacheEntry(`producer:${malId}:detail`, PRODUCER_PARSER_VERSION, fetchedAt);
    } catch (error) {
      console.warn(
        JSON.stringify({ type: 'cache_priming_failed', resource: 'producer_detail', malId, error: String(error) }),
      );
    }
  }

  private async primeCacheEntry(resourceKey: string, parserVersion: string, fetchedAt: string): Promise<void> {
    const expiresAt = new Date(Date.parse(fetchedAt) + this.config.animeTtlSeconds * 1000).toISOString();
    await this.cache.put({ resourceKey, fetchedAt, expiresAt, sourceStatus: 'success', parserVersion });
  }
}
