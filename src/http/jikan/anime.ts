import type { AnimeDetail, AnimeListEntry, Genre } from '../../domain/anime';
import type { AnimeFull } from '../../domain/anime-full';
import type { AnimeThemeSongs } from '../../domain/anime-theme';
import type { Episode } from '../../domain/episode';
import type { EpisodeDetail } from '../../domain/episode-detail';
import type { SearchEntry } from '../../domain/search';
import type { EpisodeVideoEntry, TitleVideos } from '../../domain/videos';
import { SCHEDULE_DAYS, type ScheduleByDay } from '../../parsers/schedule.parser';
import { broadcast, daterange, EMPTY_TRAILER, entities, entity, images, malUrl, relations, titles, trailer } from './primitives';

/**
 * Fields Jikan exposes that MAL's public pages never give us are emitted as null (or `[]` for
 * collections) rather than omitted: a Jikan client does `data.images.jpg.image_url` without
 * optional chaining, so a missing intermediate object throws where a null leaf does not.
 * `docs/api.md` lists every one of them.
 */
export function animeDetail(d: AnimeDetail) {
  return {
    mal_id: d.malId,
    url: malUrl('anime', d.malId),
    images: images(d.imageUrl),
    trailer: EMPTY_TRAILER,
    approved: null,
    titles: titles(d),
    title: d.title,
    title_english: d.titleEnglish,
    title_japanese: d.titleJapanese,
    title_synonyms: [],
    type: d.type,
    source: d.source,
    episodes: d.episodes,
    status: d.status,
    airing: d.status === 'Currently Airing',
    aired: daterange(d.aired),
    duration: d.duration,
    rating: d.rating,
    score: d.score,
    scored_by: null,
    rank: d.rank,
    popularity: d.popularity,
    members: d.members,
    favorites: d.favorites,
    synopsis: d.synopsis,
    background: null,
    season: null,
    year: null,
    broadcast: broadcast(),
    producers: [],
    licensors: [],
    studios: entities('producer', d.studios),
    genres: entities('anime', d.genres),
    explicit_genres: [],
    themes: entities('anime', d.themes),
    demographics: [],
    relations: relations(d.relations),
    external: d.externalLinks,
    streaming: d.streaming.map((s) => ({ name: s.name, url: s.url })),
  };
}

export function animeFull(d: AnimeFull) {
  return { ...animeDetail(d), theme: themeSongs(d.themeSongs) };
}

/** Jikan's `theme` block is two arrays of formatted strings, not structured song objects. */
export function themeSongs(songs: AnimeThemeSongs) {
  const format = (song: { title: string; artist: string | null; episodes: string | null }) =>
    [song.title, song.artist ? `by ${song.artist}` : null, song.episodes ? `(${song.episodes})` : null].filter(Boolean).join(' ');
  return { openings: songs.openings.map(format), endings: songs.endings.map(format) };
}

/** Ranking rows and season/schedule rows: the compact anime object Jikan puts in list results. */
export function animeListEntry(e: AnimeListEntry, day: string | null = null) {
  return {
    mal_id: e.malId,
    url: malUrl('anime', e.malId),
    images: images(e.imageUrl),
    title: e.title,
    titles: titles(e),
    type: e.type,
    episodes: e.episodes,
    score: e.score,
    members: e.members,
    aired: daterange(e.startDate),
    broadcast: broadcast(day),
  };
}

export function animeList(entries: AnimeListEntry[]) {
  return entries.map((entry) => animeListEntry(entry));
}

export function searchEntry(e: SearchEntry, type: 'anime' | 'manga' = 'anime') {
  return {
    mal_id: e.malId,
    url: malUrl(type, e.malId),
    images: images(e.imageUrl),
    title: e.title,
    titles: titles(e),
    type: e.type,
    episodes: e.episodes,
    score: e.score,
    synopsis: e.synopsis,
  };
}

export function searchResults(entries: SearchEntry[], type: 'anime' | 'manga' = 'anime') {
  return entries.map((entry) => searchEntry(entry, type));
}

export function episodes(rows: Episode[], animeId: number) {
  return rows.map((e) => ({
    mal_id: e.number,
    url: e.url,
    title: e.title,
    title_japanese: e.titleJapanese,
    title_romanji: null,
    aired: e.aired,
    score: e.score,
    filler: null,
    recap: null,
    forum_url: `${malUrl('anime', animeId)}/episode/${e.number}`,
    forum_replies: e.forumReplies,
  }));
}

export function episodeDetail(e: EpisodeDetail) {
  return {
    mal_id: e.episode,
    url: `${malUrl('anime', e.malId)}/episode/${e.episode}`,
    title: e.title,
    title_japanese: e.titleAlternative,
    title_romanji: null,
    duration: e.duration,
    aired: e.aired,
    synopsis: e.synopsis,
    filler: null,
    recap: null,
  };
}

export function videos(v: TitleVideos) {
  return {
    promo: v.promos.map((p) => ({ title: p.title, trailer: trailer(p.videoUrl, p.imageUrl) })),
    music_videos: v.musicVideos.map((p) => ({ title: p.title, video: trailer(p.videoUrl, p.imageUrl), meta: { title: p.title, author: null } })),
    episodes: v.episodes.map(episodeVideoEntry),
  };
}

export function episodeVideoEntry(e: EpisodeVideoEntry) {
  return { mal_id: e.episode, title: e.title, episode: `Episode ${e.episode}`, url: e.url, images: images(e.imageUrl) };
}

export function genres(rows: Genre[], type: 'anime' | 'manga') {
  return rows.map((g) => entity(type, g.malId, g.name, g.url));
}

/**
 * Jikan's `/schedules` is a flat array; ours was a map keyed by day. We flatten to match, and
 * carry the day we lost from the key into each entry's `broadcast.day` — which is exactly where
 * Jikan puts it, so nothing is actually dropped. With `?filter=monday` the service has already
 * narrowed to one day's array and there is no key left to read.
 */
export function schedule(data: ScheduleByDay | AnimeListEntry[]) {
  if (Array.isArray(data)) return animeList(data);
  return SCHEDULE_DAYS.flatMap((day) => (data[day] ?? []).map((entry) => animeListEntry(entry, broadcastDay(day))));
}

function broadcastDay(day: string): string | null {
  return day === 'other' || day === 'unknown' ? null : `${day.charAt(0).toUpperCase()}${day.slice(1)}s`;
}
