import type { RuntimeConfig } from '../config/env';
import { CHARACTER_PARSER_VERSION, type CharacterDetail } from '../domain/character';
import { CHARACTER_FULL_PARSER_VERSION, type CharacterFull } from '../domain/character-full';
import { CHARACTER_MEDIA_PARSER_VERSION, type CharacterMediaEntry } from '../domain/character-media';
import { PICTURES_PARSER_VERSION, type Picture } from '../domain/picture';
import { TOP_CHARACTERS_PARSER_VERSION, type TopCharacterEntry } from '../domain/top-character';
import type { VoiceActor } from '../domain/voice-actor';
import { parseCharacterDetail } from '../parsers/character-detail.parser';
import { parseCharacterFull } from '../parsers/character-full.parser';
import {
  parseCharacterAnimeography,
  parseCharacterMangaography,
  parseCharacterVoiceActors,
} from '../parsers/character-media.parser';
import { parsePictures } from '../parsers/pictures.parser';
import { parseTopCharacters } from '../parsers/top-characters.parser';
import { CacheRepository } from '../repositories/cache.repository';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { CharacterRepository } from '../repositories/character.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import type { CatalogSource } from '../ports/driven/catalog-source.port';
import { MalClient } from '../source/mal-client';
import { characterDetailUrl, picturesUrl, topCharactersUrl } from '../source/mal-urls';
import {
  type CacheDeps,
  ServiceError,
  type ServiceResponse,
  sourceError,
  type WaitUntil,
  withCache,
} from './cacheable';

interface CharacterMediaBundle {
  anime: CharacterMediaEntry[];
  manga: CharacterMediaEntry[];
  voices: VoiceActor[];
}

export class CharacterService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly deps: CacheDeps;
  private readonly characters: CharacterRepository;
  private readonly catalog: CatalogListRepository;
  private readonly source: CatalogSource;
  constructor(
    private readonly db: D1Database,
    private readonly config: RuntimeConfig,
    source?: CatalogSource,
    waitUntil?: WaitUntil,
  ) {
    this.cache = new CacheRepository(db);
    this.locks = new RefreshLockRepository(db);
    this.deps = { cache: this.cache, locks: this.locks, waitUntil };
    this.characters = new CharacterRepository(db);
    this.catalog = new CatalogListRepository(db);
    this.source = source ?? new MalClient(config);
  }

  private validateMalId(rawId: string): number {
    const malId = Number.parseInt(rawId, 10);
    if (!Number.isInteger(malId) || malId <= 0 || String(malId) !== rawId)
      throw new ServiceError('INVALID_CHARACTER_ID', 400, 'Character id is invalid.');
    return malId;
  }

  async detail(rawId: string, requestId: string): Promise<ServiceResponse<CharacterDetail>> {
    const malId = this.validateMalId(rawId);
    return withCache(
      this.deps,
      `character:${malId}:detail`,
      this.config.animeTtlSeconds,
      CHARACTER_PARSER_VERSION,
      () => this.characters.get(malId),
      async () => {
        const source = await this.source.getHtml(characterDetailUrl(malId), ['title-name']);
        if (source.kind !== 'success') throw sourceError(source);
        const fetchedAt = new Date().toISOString();
        const detail = parseCharacterDetail(source.value, malId, fetchedAt);
        await this.characters.put(detail, fetchedAt, CHARACTER_PARSER_VERSION);
        await this.primeSiblingsFromHtml(malId, source.value, fetchedAt, 'detail');
        return detail;
      },
      requestId,
    );
  }

  full(rawId: string, requestId: string): Promise<ServiceResponse<CharacterFull>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:character:${malId}:full`;
    return withCache(
      this.deps,
      cacheKey,
      this.config.animeTtlSeconds,
      CHARACTER_FULL_PARSER_VERSION,
      () => this.catalog.get<CharacterFull>(cacheKey),
      async () => {
        const source = await this.source.getHtml(characterDetailUrl(malId), ['title-name']);
        if (source.kind !== 'success') throw sourceError(source);
        const fetchedAt = new Date().toISOString();
        const full = parseCharacterFull(source.value, malId, fetchedAt);
        await this.catalog.put(cacheKey, full, fetchedAt, CHARACTER_FULL_PARSER_VERSION);
        await this.primeSiblingsFromFull(malId, full, fetchedAt, 'full');
        return full;
      },
      requestId,
    );
  }

  private media(rawId: string, requestId: string): Promise<ServiceResponse<CharacterMediaBundle>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:character:${malId}:media`;
    return withCache(
      this.deps,
      cacheKey,
      this.config.animeTtlSeconds,
      CHARACTER_MEDIA_PARSER_VERSION,
      () => this.catalog.get<CharacterMediaBundle>(cacheKey),
      async () => {
        const source = await this.source.getHtml(characterDetailUrl(malId), ['title-name']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = {
          anime: parseCharacterAnimeography(source.value),
          manga: parseCharacterMangaography(source.value),
          voices: parseCharacterVoiceActors(source.value),
        };
        const fetchedAt = new Date().toISOString();
        await this.catalog.put(cacheKey, value, fetchedAt, CHARACTER_MEDIA_PARSER_VERSION);
        await this.primeSiblingsFromHtml(malId, source.value, fetchedAt, 'media');
        return value;
      },
      requestId,
    );
  }

  // detail(), full() and media() (backing anime()/manga()/voices()) all read the exact same MAL
  // page — up to 3 real upstream fetches for one page if a client hits them close together.
  // parseCharacterFull already computes every sub-shape in one pass (it's detail + anime + manga +
  // voices), so whichever of the three actually refreshes primes the other two from it. Best-effort
  // — a priming failure must not fail the request that triggered it.
  private async primeSiblingsFromHtml(
    malId: number,
    html: string,
    fetchedAt: string,
    skip: 'detail' | 'media',
  ): Promise<void> {
    try {
      await this.writeSiblingCaches(malId, parseCharacterFull(html, malId, fetchedAt), fetchedAt, skip);
    } catch (error) {
      console.warn(
        JSON.stringify({ type: 'cache_priming_failed', resource: 'character', malId, error: String(error) }),
      );
    }
  }

  private async primeSiblingsFromFull(
    malId: number,
    full: CharacterFull,
    fetchedAt: string,
    skip: 'full',
  ): Promise<void> {
    try {
      await this.writeSiblingCaches(malId, full, fetchedAt, skip);
    } catch (error) {
      console.warn(
        JSON.stringify({ type: 'cache_priming_failed', resource: 'character', malId, error: String(error) }),
      );
    }
  }

  private async writeSiblingCaches(
    malId: number,
    full: CharacterFull,
    fetchedAt: string,
    skip: 'detail' | 'full' | 'media',
  ): Promise<void> {
    if (skip !== 'detail') {
      // CharacterFull is CharacterDetail plus anime/manga/voices — strip them before writing to
      // the plain detail cache, or /v1/characters/:id would leak fields only /full ever promised.
      const { anime: _animeography, manga: _mangaography, voices: _voices, ...detail } = full;
      await this.characters.put(detail, fetchedAt, CHARACTER_PARSER_VERSION);
      await this.primeCacheEntry(`character:${malId}:detail`, CHARACTER_PARSER_VERSION, fetchedAt);
    }
    if (skip !== 'full') {
      const cacheKey = `catalog:character:${malId}:full`;
      await this.catalog.put(cacheKey, full, fetchedAt, CHARACTER_FULL_PARSER_VERSION);
      await this.primeCacheEntry(cacheKey, CHARACTER_FULL_PARSER_VERSION, fetchedAt);
    }
    if (skip !== 'media') {
      const cacheKey = `catalog:character:${malId}:media`;
      const value: CharacterMediaBundle = { anime: full.anime, manga: full.manga, voices: full.voices };
      await this.catalog.put(cacheKey, value, fetchedAt, CHARACTER_MEDIA_PARSER_VERSION);
      await this.primeCacheEntry(cacheKey, CHARACTER_MEDIA_PARSER_VERSION, fetchedAt);
    }
  }

  private async primeCacheEntry(resourceKey: string, parserVersion: string, fetchedAt: string): Promise<void> {
    const expiresAt = new Date(Date.parse(fetchedAt) + this.config.animeTtlSeconds * 1000).toISOString();
    await this.cache.put({ resourceKey, fetchedAt, expiresAt, sourceStatus: 'success', parserVersion });
  }

  async anime(rawId: string, requestId: string): Promise<ServiceResponse<CharacterMediaEntry[]>> {
    const result = await this.media(rawId, requestId);
    return { ...result, data: result.data.anime };
  }

  async manga(rawId: string, requestId: string): Promise<ServiceResponse<CharacterMediaEntry[]>> {
    const result = await this.media(rawId, requestId);
    return { ...result, data: result.data.manga };
  }

  async voices(rawId: string, requestId: string): Promise<ServiceResponse<VoiceActor[]>> {
    const result = await this.media(rawId, requestId);
    return { ...result, data: result.data.voices };
  }

  pictures(rawId: string, requestId: string): Promise<ServiceResponse<Picture[]>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:character:${malId}:pictures`;
    return withCache(
      this.deps,
      cacheKey,
      this.config.animeTtlSeconds,
      PICTURES_PARSER_VERSION,
      () => this.catalog.get<Picture[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(picturesUrl('character', malId), ['js-picture-gallery']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = parsePictures(source.value);
        const fetchedAt = new Date().toISOString();
        await this.catalog.put(cacheKey, value, fetchedAt, PICTURES_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }

  topCharacters(page: number, requestId: string): Promise<ServiceResponse<TopCharacterEntry[]>> {
    const cacheKey = `catalog:top:characters:page:${page}`;
    return withCache(
      this.deps,
      cacheKey,
      this.config.catalogTtlSeconds,
      TOP_CHARACTERS_PARSER_VERSION,
      () => this.catalog.get<TopCharacterEntry[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(topCharactersUrl(page), ['ranking-list']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = parseTopCharacters(source.value);
        const fetchedAt = new Date().toISOString();
        await this.catalog.put(cacheKey, value, fetchedAt, TOP_CHARACTERS_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }
}
