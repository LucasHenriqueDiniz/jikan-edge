const BASE = 'https://myanimelist.net';

// How many rows MyAnimeList puts on one page, per family. Most of these were already encoded in
// the arithmetic below (`show=(page-1)*50`); the two that use `?p=` carried no number at all and
// were measured against the live pages: clubs.php serves 50, and a title's review page serves 20
// (the 50 in docs/routes.md is the *global* reviews feed, a different page).
export const SEARCH_PAGE_SIZE = 50;
export const USER_SEARCH_PAGE_SIZE = 24;
export const TOP_PAGE_SIZE = 50;
export const CLUB_LIST_PAGE_SIZE = 50;
export const CLUB_MEMBERS_PAGE_SIZE = 36;
export const RECOMMENDATIONS_PAGE_SIZE = 100;
export const REVIEWS_PAGE_SIZE = 50;
export const TITLE_REVIEWS_PAGE_SIZE = 20;

export function profileUrl(username: string): string {
  return `${BASE}/profile/${encodeURIComponent(username)}`;
}

export function userSubPageUrl(username: string, sub: 'friends' | 'clubs' | 'reviews' | 'recommendations'): string {
  return `${BASE}/profile/${encodeURIComponent(username)}/${sub}`;
}

// `status=7` is MAL's "All" tab. Without it the page ships a partial list: the modern layout embeds a single
// entry and loads the rest over XHR, and the classic layout renders fewer rows than the profile declares
// (AMayacrab: 273 of 360). With it, both layouts serve the whole list from the public page.
// `offset` pages the modern layout in blocks of 300; the classic layout ignores it and returns everything.
export function animeListUrl(username: string, offset = 0): string {
  return `${BASE}/animelist/${encodeURIComponent(username)}?status=7${offset > 0 ? `&offset=${offset}` : ''}`;
}

export function mangaListUrl(username: string, offset = 0): string {
  return `${BASE}/mangalist/${encodeURIComponent(username)}?status=7${offset > 0 ? `&offset=${offset}` : ''}`;
}

export function animeDetailUrl(malId: number): string {
  return `${BASE}/anime/${malId}`;
}

// MAL's ranking tabs are `type=`, and it **ignores an unrecognised value silently** — `?type=bogus`
// serves the unfiltered list with a 200. So the value has to be checked here rather than handed
// through, or `?filter=bogus` would answer 200 with the wrong list.
//
// The two media do not accept the same set, verified by comparing the id sets: anime honours all
// four, while topmanga.php only honours `bypopularity` and `favorite` — `publishing` and `upcoming`
// come back identical to the unfiltered page, because that page has no such tab. Jikan lists all
// four for manga; two of them do nothing there.
export const TOP_ANIME_FILTERS = ['airing', 'upcoming', 'bypopularity', 'favorite'] as const;
export const TOP_MANGA_FILTERS = ['bypopularity', 'favorite'] as const;

export function topAnimeUrl(page: number, filter: string | null = null): string {
  const limit = (page - 1) * TOP_PAGE_SIZE;
  const params = new URLSearchParams();
  if (filter) params.set('type', filter);
  if (limit > 0) params.set('limit', String(limit));
  const query = params.toString();
  return query ? `${BASE}/topanime.php?${query}` : `${BASE}/topanime.php`;
}

export function seasonNowUrl(): string {
  return `${BASE}/anime/season`;
}

export function seasonByYearUrl(year: number, season: string): string {
  return `${BASE}/anime/season/${year}/${season}`;
}

export function seasonUpcomingUrl(): string {
  return `${BASE}/anime/season/later`;
}

// The search page's content filter, not the genre browse page (`/anime/genre/1/Action`): MAL serves
// that page's genre sidebar truncated to ~12 entries for requests from Cloudflare's network, while
// this one carries all 78/79 entries with their categories and counts.
export function genreTaxonomyUrl(type: 'anime' | 'manga'): string {
  return `${BASE}/${type}.php?cat=genre`;
}

export function mangaDetailUrl(malId: number): string {
  return `${BASE}/manga/${malId}`;
}

export function topMangaUrl(page: number, filter: string | null = null): string {
  const limit = (page - 1) * TOP_PAGE_SIZE;
  const params = new URLSearchParams();
  if (filter) params.set('type', filter);
  if (limit > 0) params.set('limit', String(limit));
  const query = params.toString();
  return query ? `${BASE}/topmanga.php?${query}` : `${BASE}/topmanga.php`;
}

export function characterDetailUrl(malId: number): string {
  return `${BASE}/character/${malId}`;
}

export function topCharactersUrl(page: number): string {
  const limit = (page - 1) * 50;
  return limit > 0 ? `${BASE}/character.php?limit=${limit}` : `${BASE}/character.php`;
}

export function producerDetailUrl(malId: number): string {
  return `${BASE}/anime/producer/${malId}`;
}

export function clubDetailUrl(malId: number): string {
  return `${BASE}/clubs.php?cid=${malId}`;
}

export function clubListUrl(page: number): string {
  const params = new URLSearchParams();
  if (page > 1) params.set('p', String(page));
  const query = params.toString();
  return query ? `${BASE}/clubs.php?${query}` : `${BASE}/clubs.php`;
}

export function clubMembersUrl(malId: number, page: number): string {
  const show = (page - 1) * 36;
  const params = new URLSearchParams({ id: String(malId), action: 'view', t: 'members' });
  if (show > 0) params.set('show', String(show));
  return `${BASE}/clubs.php?${params.toString()}`;
}

export function personDetailUrl(malId: number): string {
  return `${BASE}/people/${malId}`;
}

export function topPeopleUrl(page: number): string {
  const limit = (page - 1) * 50;
  return limit > 0 ? `${BASE}/people.php?limit=${limit}` : `${BASE}/people.php`;
}

export function watchEpisodesUrl(popular: boolean): string {
  return `${BASE}/watch/episode${popular ? '/popular' : ''}`;
}

export function watchPromosUrl(popular: boolean): string {
  return `${BASE}/watch/promotion${popular ? '/popular' : ''}`;
}

export function recommendationsUrl(type: 'anime' | 'manga', page = 1): string {
  const show = (page - 1) * 100;
  return `${BASE}/recommendations.php?s=recentrecs&t=${type}${show > 0 ? `&show=${show}` : ''}`;
}

export function reviewsUrl(type: 'anime' | 'manga', page = 1): string {
  return `${BASE}/reviews.php?t=${type}${page > 1 ? `&p=${page}` : ''}`;
}

export function magazinesUrl(): string {
  return `${BASE}/manga/magazine`;
}

export function scheduleUrl(): string {
  return `${BASE}/anime/season/schedule`;
}

export function charactersUrl(type: 'anime' | 'manga', malId: number): string {
  // MAL requires a non-empty slug segment here (any text works, only the id is used for
  // routing) — omitting it entirely returns a different, much shorter page without the
  // character/staff tables.
  return `${BASE}/${type}/${malId}/x/characters`;
}

export function statisticsUrl(type: 'anime' | 'manga', malId: number): string {
  return `${BASE}/${type}/${malId}/x/stats`;
}

export function picturesUrl(type: 'anime' | 'manga' | 'character' | 'people', malId: number): string {
  return `${BASE}/${type}/${malId}/x/pics`;
}

export function newsUrl(type: 'anime' | 'manga' | 'people', malId: number): string {
  return `${BASE}/${type}/${malId}/x/news`;
}

export function forumUrl(type: 'anime' | 'manga', malId: number): string {
  return `${BASE}/${type}/${malId}/x/forum`;
}

export function titleReviewsUrl(type: 'anime' | 'manga', malId: number, page: number): string {
  return page > 1 ? `${BASE}/${type}/${malId}/x/reviews?p=${page}` : `${BASE}/${type}/${malId}/x/reviews`;
}

export function titleRecommendationsUrl(type: 'anime' | 'manga', malId: number): string {
  return `${BASE}/${type}/${malId}/x/userrecs`;
}

export function moreInfoUrl(type: 'anime' | 'manga', malId: number): string {
  return `${BASE}/${type}/${malId}/x/moreinfo`;
}

export function episodesUrl(malId: number): string {
  // MAL paginates this page for long-running shows, but the query param format wasn't
  // confirmed — only the first page is fetched for now (see docs/routes.md).
  return `${BASE}/anime/${malId}/x/episode`;
}

export function searchUrl(type: 'anime' | 'manga' | 'character' | 'people', query: string, page: number, extra: [string, string][] = []): string {
  const show = (page - 1) * 50;
  const params = new URLSearchParams({ q: query });
  // MAL's own search form posts a hidden `cat` field, and leaving it out is not neutral. With a
  // single genre and nothing else, `anime.php?q=&genre[]=1` answers 301 -> /anime/genre/1/Action, a
  // genre-browse page with different markup and no result rows for this parser to find. That is why
  // `?genres=N` alone returned an empty list on page 1 only: from page 2 on, `show=` is a second
  // parameter, which is enough to suppress the redirect. Sending what the form sends keeps every
  // search on the search page. Character and people search carry the field too (`cat=character`,
  // `cat=person`) but never redirect, so they are left alone rather than churning their caches.
  if (type === 'anime' || type === 'manga') params.set('cat', type);
  if (show > 0) params.set('show', String(show));
  for (const [key, value] of extra) params.append(key, value);
  return `${BASE}/${type}.php?${params.toString()}`;
}

export function producersIndexUrl(): string {
  return `${BASE}/anime/producer`;
}

export function seasonArchiveUrl(): string {
  return `${BASE}/anime/season/archive`;
}

export function videosUrl(malId: number): string {
  return `${BASE}/anime/${malId}/x/video`;
}

export function episodeDetailUrl(malId: number, episode: number): string {
  return `${BASE}/anime/${malId}/x/episode/${episode}`;
}

export function userSearchUrl(query: string, page: number): string {
  const show = (page - 1) * 24;
  const params = new URLSearchParams({ q: query });
  if (show > 0) params.set('show', String(show));
  return `${BASE}/users.php?${params.toString()}`;
}
