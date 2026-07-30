import type { RuntimeConfig } from '../config/env';
import { CHARACTER_PARSER_VERSION, type CharacterDetail } from '../domain/character';
import { CHARACTER_FULL_PARSER_VERSION, type CharacterFull } from '../domain/character-full';
import { CHARACTER_MEDIA_PARSER_VERSION, type CharacterMediaEntry } from '../domain/character-media';
import { PICTURES_PARSER_VERSION, type Picture } from '../domain/picture';
import { TOP_CHARACTERS_PARSER_VERSION, type TopCharacterEntry } from '../domain/top-character';
import type { VoiceActor } from '../domain/voice-actor';
import { parseCharacterDetail } from '../parsers/character-detail.parser';
import { parseCharacterFull } from '../parsers/character-full.parser';
import { parseCharacterAnimeography, parseCharacterMangaography, parseCharacterVoiceActors } from '../parsers/character-media.parser';
import { parsePictures } from '../parsers/pictures.parser';
import { parseTopCharacters } from '../parsers/top-characters.parser';
import { CacheRepository } from '../repositories/cache.repository';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { CharacterRepository } from '../repositories/character.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import { MalClient } from '../source/mal-client';
import { characterDetailUrl, picturesUrl, topCharactersUrl } from '../source/mal-urls';
import { ServiceError, type ServiceResponse, sourceError, withCache } from './cacheable';

interface CharacterMediaBundle {
  anime: CharacterMediaEntry[];
  manga: CharacterMediaEntry[];
  voices: VoiceActor[];
}

export class CharacterService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly characters: CharacterRepository;
  private readonly catalog: CatalogListRepository;
  private readonly source: MalClient;
  constructor(private readonly db: D1Database, private readonly config: RuntimeConfig, source?: MalClient) {
    this.cache = new CacheRepository(db); this.locks = new RefreshLockRepository(db); this.characters = new CharacterRepository(db); this.catalog = new CatalogListRepository(db); this.source = source ?? new MalClient(config);
  }

  private validateMalId(rawId: string): number {
    const malId = Number.parseInt(rawId, 10);
    if (!Number.isInteger(malId) || malId <= 0 || String(malId) !== rawId) throw new ServiceError('INVALID_CHARACTER_ID', 400, 'Character id is invalid.');
    return malId;
  }

  async detail(rawId: string, requestId: string): Promise<ServiceResponse<CharacterDetail>> {
    const malId = this.validateMalId(rawId);
    return withCache({ cache: this.cache, locks: this.locks }, `character:${malId}:detail`, this.config.animeTtlSeconds, CHARACTER_PARSER_VERSION, () => this.characters.get(malId), async () => {
      const source = await this.source.getHtml(characterDetailUrl(malId), ['title-name']);
      if (source.kind !== 'success') throw sourceError(source);
      const fetchedAt = new Date().toISOString();
      const detail = parseCharacterDetail(source.value, malId, fetchedAt);
      await this.characters.put(detail, fetchedAt, CHARACTER_PARSER_VERSION);
      return detail;
    }, requestId);
  }

  full(rawId: string, requestId: string): Promise<ServiceResponse<CharacterFull>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:character:${malId}:full`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, CHARACTER_FULL_PARSER_VERSION, () => this.catalog.get<CharacterFull>(cacheKey), async () => {
      const source = await this.source.getHtml(characterDetailUrl(malId), ['title-name']);
      if (source.kind !== 'success') throw sourceError(source);
      const fetchedAt = new Date().toISOString();
      const full = parseCharacterFull(source.value, malId, fetchedAt);
      await this.catalog.put(cacheKey, full, fetchedAt, CHARACTER_FULL_PARSER_VERSION);
      return full;
    }, requestId);
  }

  private media(rawId: string, requestId: string): Promise<ServiceResponse<CharacterMediaBundle>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:character:${malId}:media`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, CHARACTER_MEDIA_PARSER_VERSION, () => this.catalog.get<CharacterMediaBundle>(cacheKey), async () => {
      const source = await this.source.getHtml(characterDetailUrl(malId), ['title-name']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = { anime: parseCharacterAnimeography(source.value), manga: parseCharacterMangaography(source.value), voices: parseCharacterVoiceActors(source.value) };
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, CHARACTER_MEDIA_PARSER_VERSION);
      return value;
    }, requestId);
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
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, PICTURES_PARSER_VERSION, () => this.catalog.get<Picture[]>(cacheKey), async () => {
      const source = await this.source.getHtml(picturesUrl('character', malId), ['js-picture-gallery']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parsePictures(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, PICTURES_PARSER_VERSION);
      return value;
    }, requestId);
  }

  topCharacters(page: number, requestId: string): Promise<ServiceResponse<TopCharacterEntry[]>> {
    const cacheKey = `catalog:top:characters:page:${page}`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, TOP_CHARACTERS_PARSER_VERSION, () => this.catalog.get<TopCharacterEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(topCharactersUrl(page), ['ranking-list']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseTopCharacters(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, TOP_CHARACTERS_PARSER_VERSION);
      return value;
    }, requestId);
  }
}
