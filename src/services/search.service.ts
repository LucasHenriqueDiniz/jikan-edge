import type { RuntimeConfig } from '../config/env';
import { CHARACTER_SEARCH_PARSER_VERSION, type CharacterSearchResult } from '../domain/character-search';
import { PERSON_SEARCH_PARSER_VERSION, type PersonSearchResult } from '../domain/person-search';
import type { AnimeDetail } from '../domain/anime';
import type { MangaDetail } from '../domain/manga';
import {
  ANIME_SEARCH_PARSER_VERSION,
  type AnimeSearchEntry,
  MANGA_SEARCH_PARSER_VERSION,
  type MangaSearchEntry,
  type SearchEntry,
} from '../domain/search';
import { parseAnimeDetail } from '../parsers/anime-detail.parser';
import { parseMangaDetail } from '../parsers/manga-detail.parser';
import { USER_SEARCH_PARSER_VERSION, type UserSearchResult } from '../domain/user-search';
import { parseCharacterSearch } from '../parsers/character-search.parser';
import { ParserError } from '../parsers/html';
import { parsePersonSearch } from '../parsers/person-search.parser';
import { parseAnimeSearchResults, parseMangaSearchResults } from '../parsers/search.parser';
import { parseUserSearch } from '../parsers/user-search.parser';
import type { CatalogSource } from '../ports/driven/catalog-source.port';
import type { CatalogStore } from '../ports/driven/catalog-store.port';
import { searchUrl, userSearchUrl } from '../source/mal-urls';
import {
  type CacheDeps,
  ServiceError,
  type ServiceResponse,
  sourceError,
  storeEmptyPage,
  type WaitUntil,
  withCache,
} from './cacheable';

const MAX_QUERY_LENGTH = 64;

// An exact-title search on MAL 303-redirects to the entity's detail page; MalClient follows the
// redirect, so metadata.finalUrl is a detail URL like https://myanimelist.net/anime/1/Cowboy_Bebop.
// Routing on that is more precise than the old title-string marker guard, which rejected the detail
// page as UPSTREAM_SUSPICIOUS (issue #16). Genre-browse redirects land on /anime/genre/... — no
// trailing id — so this pattern does not match them.
const DETAIL_LANDING = /^https:\/\/myanimelist\.net\/(anime|manga)\/(\d+)\b/;

// The results table's Rated column prints the short form (`PG-13`, `R+`), the detail page the long one
// (`PG-13 - Teens 13 or older`). An exact-title match must answer in the same form as a results row.
function shortRating(rating: string | null): string | null {
  const short = rating?.split(' - ')[0].trim();
  return short && short !== 'None' ? short : null;
}

// AnimeDetail carries every SearchEntry field; the one gap is url, which is nullable on the detail
// but required on the entry, so it falls back to the landing URL (the canonical detail URL). The dates
// are the detail's own, which are full dates or null — a results row can also carry `2027-10`.
function animeDetailToEntry(detail: AnimeDetail, landed: string): AnimeSearchEntry {
  return {
    malId: detail.malId,
    url: detail.url ?? landed,
    title: detail.title,
    imageUrl: detail.imageUrl,
    synopsis: detail.synopsis,
    type: detail.type,
    score: detail.score,
    startDate: detail.aired.from,
    endDate: detail.aired.to,
    members: detail.members,
    episodes: detail.episodes,
    rating: shortRating(detail.rating),
  };
}

// The manga counterpart: the middle column is volumes, not episodes (the documented anime/manga
// search asymmetry). Same url fallback as the anime mapper.
function mangaDetailToEntry(detail: MangaDetail, landed: string): MangaSearchEntry {
  return {
    malId: detail.malId,
    url: detail.url ?? landed,
    title: detail.title,
    imageUrl: detail.imageUrl,
    synopsis: detail.synopsis,
    type: detail.type,
    score: detail.score,
    startDate: detail.published.from,
    endDate: detail.published.to,
    members: detail.members,
    volumes: detail.volumes,
    chapters: detail.chapters,
  };
}

interface TitleSearchFilters {
  type?: string;
  status?: string;
  rating?: string;
  score?: string;
  minScore?: string;
  genres?: string;
  magazines?: string;
  orderBy?: string;
  sort?: string;
  letter?: string;
  startDate?: string;
  endDate?: string;
}

// All values verified against real anime.php/manga.php responses (server-side filtering confirmed;
// see docs/routes.md). order_by uses the sort-column codes from the results-table header links.
//
// The type codes are the search form's own `<option>` values (re-read 2026-10-11), each confirmed by
// the type column of the results: anime `7` returns only CM, `8` only PV, `9` only TV Special; manga
// `2` only Light Novel and `8` only Novel. `novel` used to map to `2`, so `?type=novel` returned light
// novels.
const ANIME_TYPE_MAP: Record<string, string> = {
  tv: '1',
  ova: '2',
  movie: '3',
  special: '4',
  ona: '5',
  music: '6',
  cm: '7',
  pv: '8',
  tv_special: '9',
};
const MANGA_TYPE_MAP: Record<string, string> = {
  manga: '1',
  lightnovel: '2',
  oneshot: '3',
  doujin: '4',
  manhwa: '5',
  manhua: '6',
  novel: '8',
};
const STATUS_MAP: Record<string, string> = {
  airing: '1',
  publishing: '1',
  complete: '2',
  finished: '2',
  upcoming: '3',
};
// Two statuses only the manga form has: "On Hiatus" and "Discontinued".
const MANGA_ONLY_STATUS_MAP: Record<string, string> = { hiatus: '4', discontinued: '5' };
const RATING_MAP: Record<string, string> = { g: '1', pg: '2', pg13: '3', r17: '4', r: '5', rx: '6' };
// The `o=` column codes, each checked against the live results rather than taken from Jikan's
// legacy builder: `episodes` sorts 500/293/220, `id` sorts 64614/64501/64487, `members` puts Naruto
// and Shippuuden first, `rated` groups by classification. **`title` (code 0) is not here on
// purpose** — it returns the same order for both directions and is not alphabetical, so MAL is
// ignoring it, and offering it would be an ordering that does not order.
const ORDER_BY_MAP: Record<string, string> = {
  start_date: '2',
  score: '3',
  episodes: '4',
  volumes: '4',
  end_date: '5',
  type: '6',
  members: '7',
  rating: '8',
  mal_id: '9',
};

function buildTitleSearchParams(type: 'anime' | 'manga', filters: TitleSearchFilters): [string, string][] {
  const extra: [string, string][] = [];
  const fail = (name: string, allowed: string[]): never => {
    throw new ServiceError('INVALID_FILTER', 400, `Invalid "${name}"; allowed: ${allowed.join(', ')}.`);
  };
  if (filters.type) {
    const map = type === 'anime' ? ANIME_TYPE_MAP : MANGA_TYPE_MAP;
    extra.push(['type', map[filters.type.toLowerCase()] ?? fail('type', Object.keys(map))]);
  }
  if (filters.status) {
    const map = type === 'manga' ? { ...STATUS_MAP, ...MANGA_ONLY_STATUS_MAP } : STATUS_MAP;
    extra.push(['status', map[filters.status.toLowerCase()] ?? fail('status', Object.keys(map))]);
  }
  if (filters.rating) {
    if (type !== 'anime') throw new ServiceError('INVALID_FILTER', 400, '"rating" only applies to anime search.');
    extra.push(['r', RATING_MAP[filters.rating.toLowerCase()] ?? fail('rating', Object.keys(RATING_MAP))]);
  }
  // MAL's form has one score dropdown, and it is a minimum — so `score` and `min_score` are the
  // same knob under two names. Accepting both is for people porting from Jikan; setting both to
  // different values is a contradiction worth refusing rather than silently picking one.
  const rawScore = filters.score ?? filters.minScore;
  if (filters.score && filters.minScore && filters.score !== filters.minScore) {
    throw new ServiceError(
      'INVALID_FILTER',
      400,
      '"score" and "min_score" are the same filter on MyAnimeList; pass only one.',
    );
  }
  if (rawScore) {
    const score = Number.parseInt(rawScore, 10);
    if (!Number.isInteger(score) || score < 1 || score > 10 || String(score) !== rawScore)
      throw new ServiceError('INVALID_FILTER', 400, '"score" must be an integer 1-10.');
    extra.push(['score', String(score)]);
  }
  // Multiple ids are ANDed by MyAnimeList, not ORed: on "love", `genre[]=12` returns 16 and
  // `genre[]=49` returns 3, but the two together return 0 — an entry has to carry every id given.
  if (filters.genres) {
    for (const raw of filters.genres.split(',')) {
      const genreId = Number.parseInt(raw.trim(), 10);
      if (!Number.isInteger(genreId) || genreId <= 0)
        throw new ServiceError('INVALID_FILTER', 400, '"genres" must be comma-separated positive genre ids.');
      extra.push(['genre[]', String(genreId)]);
    }
  }
  // A magazine filter exists for manga only, as `mid=`. Confirmed: "berserk" alone returns 50
  // results, `mid=2` (Young Animal) narrows it to the 2 that actually run there.
  if (filters.magazines) {
    if (type !== 'manga') throw new ServiceError('INVALID_FILTER', 400, '"magazines" only applies to manga search.');
    const ids = filters.magazines.split(',').map((raw) => Number.parseInt(raw.trim(), 10));
    if (ids.length !== 1 || !Number.isInteger(ids[0]) || ids[0] <= 0) {
      throw new ServiceError(
        'INVALID_FILTER',
        400,
        '"magazines" takes a single positive magazine id; MyAnimeList\'s search accepts one.',
      );
    }
    extra.push(['mid', String(ids[0])]);
  }
  // MAL's advanced search splits each bound into three selects — month, day, year, in that order:
  // `sm`/`sd`/`sy` for the start bound and `em`/`ed`/`ey` for the end one. Verified against the
  // live search and against the results' own Aired field: `ey=2005&em=12&ed=31` on "naruto" returns
  // titles from 2003, 2004 and 2005 and nothing later.
  //
  // One edge worth knowing rather than hiding: an entry whose date MAL does not have ("Aired: Not
  // available") is *included* by either bound rather than filtered out.
  for (const [value, name, keys] of [
    [filters.startDate, 'start_date', ['sm', 'sd', 'sy']],
    [filters.endDate, 'end_date', ['em', 'ed', 'ey']],
  ] as const) {
    if (!value) continue;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new ServiceError('INVALID_FILTER', 400, `"${name}" must be a date in YYYY-MM-DD form.`);
    const [, year, month, day] = match;
    if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) {
      throw new ServiceError('INVALID_FILTER', 400, `"${name}" is not a real date.`);
    }
    extra.push([keys[0], String(Number(month))], [keys[1], String(Number(day))], [keys[2], year]);
  }
  if (filters.letter) {
    if (!/^[A-Za-z]$/.test(filters.letter))
      throw new ServiceError('INVALID_FILTER', 400, '"letter" must be a single letter.');
    extra.push(['letter', filters.letter.toUpperCase()]);
  }
  if (filters.orderBy) {
    extra.push(['o', ORDER_BY_MAP[filters.orderBy.toLowerCase()] ?? fail('order_by', Object.keys(ORDER_BY_MAP))]);
    // `w` is the direction: 1 descending, 2 ascending. Confirmed against the live search —
    // `o=3&w=1` returns Gintama and Shingeki, `o=3&w=2` returns the bottom of the score table.
    extra.push(['w', filters.sort?.toLowerCase() === 'asc' ? '2' : '1']);
  } else if (filters.sort) {
    throw new ServiceError('INVALID_FILTER', 400, '"sort" needs "order_by" to say which column to sort.');
  }
  if (filters.sort && !['asc', 'desc'].includes(filters.sort.toLowerCase())) {
    throw new ServiceError('INVALID_FILTER', 400, '"sort" must be "asc" or "desc".');
  }
  return extra;
}

export class SearchService {
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

  private validateQuery(rawQuery: string | undefined): string {
    const query = (rawQuery ?? '').trim();
    if (!query || query.length > MAX_QUERY_LENGTH)
      throw new ServiceError('INVALID_QUERY', 400, 'Query parameter "q" is required and must be 1-64 characters.');
    return query;
  }

  private async search(
    type: 'anime' | 'manga',
    rawQuery: string | undefined,
    page: number,
    filters: TitleSearchFilters,
    requestId: string,
  ): Promise<ServiceResponse<SearchEntry[]>> {
    const extra = buildTitleSearchParams(type, filters);
    // A pure filter search (no text query) is valid on MAL — q is only required when there are
    // no filters at all, otherwise the request would be an unbounded catalog dump.
    const query = extra.length > 0 && !(rawQuery ?? '').trim() ? '' : this.validateQuery(rawQuery);
    const filterKey = extra.map(([key, value]) => `${key}=${value}`).join('&');
    const cacheKey = `catalog:search:${type}:${query.toLowerCase()}:page:${page}${filterKey ? `:${filterKey}` : ''}`;
    // Separate versions because the two searches no longer share a shape: the anime row's middle
    // column is episodes, the manga row's is volumes.
    const version = type === 'anime' ? ANIME_SEARCH_PARSER_VERSION : MANGA_SEARCH_PARSER_VERSION;
    return withCache(
      this.deps,
      cacheKey,
      this.config.catalogTtlSeconds,
      version,
      () => this.catalog.get<SearchEntry[]>(cacheKey),
      async () => {
        // Route on where the fetch actually landed (metadata.finalUrl), not a title-string marker.
        // MAL redirects an exact-title search to the detail page; the old marker guard
        // ('Search Anime - MyAnimeList.net', absent on a detail page) turned that into a 502. The
        // landing URL tells us precisely which page we got: the search page, a detail page, or a
        // wrong page (e.g. the genre-browse redirect the old marker existed to catch).
        // getHtml is called with no required marker, because an exact-title match legitimately
        // lands on the detail page (which has no search marker). The marker is instead checked
        // below, on the results branch only, so a wrong body served at the search URL (the
        // genre-browse page MAL used to redirect us to) is still refused rather than parsed as empty.
        const marker = type === 'anime' ? 'Search Anime - MyAnimeList.net' : 'Search Manga - MyAnimeList.net';
        // MAL treats a query under three characters as matching nothing (`q=86` and `q=ab` both come
        // back "No titles that matched"), so the anime called *86* was unreachable. Quoted, the same
        // query is searched: `q="86"` returns the 86 titles. Quoting also switches MAL to substring
        // matching (it brings *GR86 x Initial D* too), so longer queries are left as typed.
        const sourceQuery = query.length > 0 && query.length < 3 ? `"${query}"` : query;
        const source = await this.source.getHtml(searchUrl(type, sourceQuery, page, extra), []);
        // Zero results and a page past the end are both a 404 here — the first with the search page and
        // "No titles that matched your query were found.", the second with MAL's generic page — and both
        // mean the same thing to the caller: an empty page, not a missing resource.
        if (source.kind === 'not_found') {
          return storeEmptyPage(this.catalog, cacheKey, version);
        }
        if (source.kind !== 'success') throw sourceError(source);
        const landed = source.metadata.finalUrl ?? source.metadata.url;
        const detail = landed.match(DETAIL_LANDING);
        let value: SearchEntry[];
        if (detail && detail[1] === type) {
          // An exact-title match: the body is the entity's detail page. Reuse the detail parser and
          // map it to a single search entry — the title the user searched for. A detail page that
          // cannot be parsed (an independent detail-parser gap on some real pages) degrades to 502
          // UPSTREAM_SUSPICIOUS like the rest of the API, rather than leaking a ParserError as a 500.
          const malId = Number(detail[2]);
          try {
            value =
              type === 'anime'
                ? [animeDetailToEntry(parseAnimeDetail(source.value, malId), landed)]
                : [mangaDetailToEntry(parseMangaDetail(source.value, malId), landed)];
          } catch (error) {
            if (error instanceof ParserError) {
              throw sourceError({
                kind: 'suspicious',
                reason: `detail_parse_failed:${error.message}`,
                metadata: source.metadata,
              });
            }
            throw error;
          }
        } else if (landed.includes(`/${type}.php`) && source.value.includes(marker)) {
          value = type === 'anime' ? parseAnimeSearchResults(source.value) : parseMangaSearchResults(source.value);
        } else {
          // Neither a detail page nor a genuine search page — e.g. the /anime/genre/... browse page.
          throw sourceError({ kind: 'suspicious', reason: 'unexpected_search_landing', metadata: source.metadata });
        }
        const fetchedAt = new Date().toISOString();
        await this.catalog.put(cacheKey, value, fetchedAt, version);
        return value;
      },
      requestId,
    );
  }

  anime(
    query: string | undefined,
    page: number,
    filters: TitleSearchFilters,
    requestId: string,
  ): Promise<ServiceResponse<SearchEntry[]>> {
    return this.search('anime', query, page, filters, requestId);
  }
  manga(
    query: string | undefined,
    page: number,
    filters: TitleSearchFilters,
    requestId: string,
  ): Promise<ServiceResponse<SearchEntry[]>> {
    return this.search('manga', query, page, filters, requestId);
  }

  users(rawQuery: string | undefined, page: number, requestId: string): Promise<ServiceResponse<UserSearchResult[]>> {
    const query = this.validateQuery(rawQuery);
    const cacheKey = `catalog:search:users:${query.toLowerCase()}:page:${page}`;
    return withCache(
      this.deps,
      cacheKey,
      this.config.catalogTtlSeconds,
      USER_SEARCH_PARSER_VERSION,
      () => this.catalog.get<UserSearchResult[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(userSearchUrl(query, page), []);
        // "No users found" comes with a 404. Further out MAL stops paginating altogether and answers
        // 400 (measured: `show=1008` is a 404, `show=2400` a 400), which past page 1 is the same end.
        if (
          source.kind === 'not_found' ||
          (page > 1 && source.kind === 'upstream_error' && source.reason === 'bad_request')
        ) {
          return storeEmptyPage(this.catalog, cacheKey, USER_SEARCH_PARSER_VERSION);
        }
        if (source.kind !== 'success') throw sourceError(source);
        let value: UserSearchResult[];
        try {
          value = parseUserSearch(source.value, query);
        } catch (error) {
          // Two legitimate shapes exist here (a results list, or an exact match redirecting straight
          // to a single profile), so a blanket requiredMarkers check on getHtml would false-positive
          // on whichever shape it didn't ask for. Anything that fails to parse as either is upstream
          // behaving unexpectedly, not a bug on our side — the same 502 every other route gives for a
          // suspicious response, instead of leaking a raw ParserError as a generic 500.
          if (error instanceof ParserError)
            throw sourceError({ kind: 'suspicious', reason: error.message, metadata: source.metadata });
          throw error;
        }
        const fetchedAt = new Date().toISOString();
        await this.catalog.put(cacheKey, value, fetchedAt, USER_SEARCH_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }

  characters(
    rawQuery: string | undefined,
    page: number,
    requestId: string,
  ): Promise<ServiceResponse<CharacterSearchResult[]>> {
    const query = this.validateQuery(rawQuery);
    const cacheKey = `catalog:search:characters:${query.toLowerCase()}:page:${page}`;
    return withCache(
      this.deps,
      cacheKey,
      this.config.catalogTtlSeconds,
      CHARACTER_SEARCH_PARSER_VERSION,
      () => this.catalog.get<CharacterSearchResult[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(searchUrl('character', query, page), ['Search Results']);
        // "No results found" with a 404, for zero matches and past the last page alike.
        if (source.kind === 'not_found') {
          return storeEmptyPage(this.catalog, cacheKey, CHARACTER_SEARCH_PARSER_VERSION);
        }
        if (source.kind !== 'success') throw sourceError(source);
        const value = parseCharacterSearch(source.value);
        const fetchedAt = new Date().toISOString();
        await this.catalog.put(cacheKey, value, fetchedAt, CHARACTER_SEARCH_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }

  people(
    rawQuery: string | undefined,
    page: number,
    requestId: string,
  ): Promise<ServiceResponse<PersonSearchResult[]>> {
    const query = this.validateQuery(rawQuery);
    const cacheKey = `catalog:search:people:${query.toLowerCase()}:page:${page}`;
    return withCache(
      this.deps,
      cacheKey,
      this.config.catalogTtlSeconds,
      PERSON_SEARCH_PARSER_VERSION,
      () => this.catalog.get<PersonSearchResult[]>(cacheKey),
      async () => {
        const source = await this.source.getHtml(searchUrl('people', query, page), ['Search Results']);
        if (source.kind !== 'success') throw sourceError(source);
        const value = parsePersonSearch(source.value);
        const fetchedAt = new Date().toISOString();
        await this.catalog.put(cacheKey, value, fetchedAt, PERSON_SEARCH_PARSER_VERSION);
        return value;
      },
      requestId,
    );
  }
}
