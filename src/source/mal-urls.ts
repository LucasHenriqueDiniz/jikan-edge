const BASE = 'https://myanimelist.net';

export function profileUrl(username: string): string {
  return `${BASE}/profile/${encodeURIComponent(username)}`;
}

export function userSubPageUrl(username: string, sub: 'friends' | 'clubs' | 'reviews' | 'recommendations'): string {
  return `${BASE}/profile/${encodeURIComponent(username)}/${sub}`;
}

export function animeListUrl(username: string): string {
  return `${BASE}/animelist/${encodeURIComponent(username)}`;
}

export function mangaListUrl(username: string): string {
  return `${BASE}/mangalist/${encodeURIComponent(username)}`;
}

export function animeDetailUrl(malId: number): string {
  return `${BASE}/anime/${malId}`;
}

export function topAnimeUrl(page: number): string {
  const limit = (page - 1) * 50;
  return limit > 0 ? `${BASE}/topanime.php?limit=${limit}` : `${BASE}/topanime.php`;
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

export function genreTaxonomyUrl(): string {
  return `${BASE}/anime/genre/1/Action`;
}

export function mangaDetailUrl(malId: number): string {
  return `${BASE}/manga/${malId}`;
}

export function topMangaUrl(page: number): string {
  const limit = (page - 1) * 50;
  return limit > 0 ? `${BASE}/topmanga.php?limit=${limit}` : `${BASE}/topmanga.php`;
}

export function genreTaxonomyMangaUrl(): string {
  return `${BASE}/manga/genre/1/Action`;
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

/** Not fetched today — used to build the `url` we hand back for a magazine entity. */
export function magazineDetailUrl(malId: number): string {
  return `${BASE}/manga/magazine/${malId}`;
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
