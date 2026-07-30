import type { RuntimeConfig } from '../config/env';
import { CLUB_PARSER_VERSION, type ClubDetail } from '../domain/club';
import { CLUB_LIST_PARSER_VERSION, type ClubListEntry } from '../domain/club-list';
import { CLUB_MEMBERS_PARSER_VERSION, type ClubMember } from '../domain/club-member';
import { parseClubDetail } from '../parsers/club-detail.parser';
import { parseClubList } from '../parsers/club-list.parser';
import { parseClubMembers } from '../parsers/club-members.parser';
import { CLUB_RELATIONS_PARSER_VERSION, parseClubRelations, type ClubRelations } from '../parsers/club-relations.parser';
import { CacheRepository } from '../repositories/cache.repository';
import { CatalogListRepository } from '../repositories/catalog-list.repository';
import { ClubRepository } from '../repositories/club.repository';
import { RefreshLockRepository } from '../repositories/refresh-lock.repository';
import { MalClient } from '../source/mal-client';
import { clubDetailUrl, clubListUrl, clubMembersUrl } from '../source/mal-urls';
import { ServiceError, type ServiceResponse, sourceError, withCache } from './cacheable';

export class ClubService {
  private readonly cache: CacheRepository;
  private readonly locks: RefreshLockRepository;
  private readonly clubs: ClubRepository;
  private readonly catalog: CatalogListRepository;
  private readonly source: MalClient;
  constructor(private readonly db: D1Database, private readonly config: RuntimeConfig, source?: MalClient) {
    this.cache = new CacheRepository(db); this.locks = new RefreshLockRepository(db); this.clubs = new ClubRepository(db); this.catalog = new CatalogListRepository(db); this.source = source ?? new MalClient(config);
  }

  private validateMalId(rawId: string): number {
    const malId = Number.parseInt(rawId, 10);
    if (!Number.isInteger(malId) || malId <= 0 || String(malId) !== rawId) throw new ServiceError('INVALID_CLUB_ID', 400, 'Club id is invalid.');
    return malId;
  }

  async detail(rawId: string, requestId: string): Promise<ServiceResponse<ClubDetail>> {
    const malId = this.validateMalId(rawId);
    return withCache({ cache: this.cache, locks: this.locks }, `club:${malId}:detail`, this.config.animeTtlSeconds, CLUB_PARSER_VERSION, () => this.clubs.get(malId), async () => {
      const source = await this.source.getHtml(clubDetailUrl(malId), ['Club Stats']);
      if (source.kind !== 'success') throw sourceError(source);
      const fetchedAt = new Date().toISOString();
      const detail = parseClubDetail(source.value, malId, fetchedAt);
      await this.clubs.put(detail, fetchedAt, CLUB_PARSER_VERSION);
      return detail;
    }, requestId);
  }

  list(page: number, requestId: string): Promise<ServiceResponse<ClubListEntry[]>> {
    const cacheKey = `catalog:clubs:page:${page}`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.catalogTtlSeconds, CLUB_LIST_PARSER_VERSION, () => this.catalog.get<ClubListEntry[]>(cacheKey), async () => {
      const source = await this.source.getHtml(clubListUrl(page), ['class="club-list"']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseClubList(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, CLUB_LIST_PARSER_VERSION);
      return value;
    }, requestId);
  }

  async staff(rawId: string, requestId: string): Promise<ServiceResponse<string[]>> {
    const result = await this.detail(rawId, requestId);
    return { ...result, data: result.data.staff };
  }

  relations(rawId: string, requestId: string): Promise<ServiceResponse<ClubRelations>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:club:${malId}:relations`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, CLUB_RELATIONS_PARSER_VERSION, () => this.catalog.get<ClubRelations>(cacheKey), async () => {
      const source = await this.source.getHtml(clubDetailUrl(malId), ['Club Stats']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseClubRelations(source.value);
      await this.catalog.put(cacheKey, value, new Date().toISOString(), CLUB_RELATIONS_PARSER_VERSION);
      return value;
    }, requestId);
  }

  members(rawId: string, page: number, requestId: string): Promise<ServiceResponse<ClubMember[]>> {
    const malId = this.validateMalId(rawId);
    const cacheKey = `catalog:club:${malId}:members:page:${page}`;
    return withCache({ cache: this.cache, locks: this.locks }, cacheKey, this.config.animeTtlSeconds, CLUB_MEMBERS_PARSER_VERSION, () => this.catalog.get<ClubMember[]>(cacheKey), async () => {
      const source = await this.source.getHtml(clubMembersUrl(malId, page), ['<td align="center"  class="borderClass">']);
      if (source.kind !== 'success') throw sourceError(source);
      const value = parseClubMembers(source.value);
      const fetchedAt = new Date().toISOString();
      await this.catalog.put(cacheKey, value, fetchedAt, CLUB_MEMBERS_PARSER_VERSION);
      return value;
    }, requestId);
  }
}
