import type { ImageSet } from './image';
import type { MalRef } from './mal-ref';
export interface RelationEntry {
  relation: string;
  malId: number;
  type: 'anime' | 'manga';
  title: string;
}

export interface ExternalLink {
  name: string;
  url: string;
}

export interface StreamingEntry {
  name: string;
  url: string;
  available: boolean;
}

// MAL prints a date range as one string ("Apr 3, 1998 to Apr 24, 1999"). `string` keeps that
// verbatim; `from`/`to` are the ISO dates parsed out of it, and are null when the page is vague
// ("2024 to ?"). Jikan nests a redundant `prop.from.{day,month,year}` alongside — dropped here,
// since it carries nothing `from` does not.
export interface DateRange {
  from: string | null;
  to: string | null;
  string: string | null;
}

export interface Broadcast {
  day: string | null;
  time: string | null;
  timezone: string | null;
  string: string | null;
}

export interface Trailer {
  youtubeId: string | null;
  url: string | null;
  embedUrl: string | null;
}

export interface AnimeDetail {
  malId: number;
  url: string | null;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  titleSynonyms: string[];
  imageUrl: string | null;
  images: ImageSet;
  trailer: Trailer;
  synopsis: string | null;
  background: string | null;
  type: string | null;
  episodes: number | null;
  status: string | null;
  airing: boolean;
  aired: DateRange;
  season: string | null;
  year: number | null;
  broadcast: Broadcast;
  studios: MalRef[];
  producers: MalRef[];
  licensors: MalRef[];
  genres: MalRef[];
  themes: MalRef[];
  demographics: MalRef[];
  duration: string | null;
  rating: string | null;
  score: number | null;
  scoredBy: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  favorites: number | null;
  source: string | null;
  relations: RelationEntry[];
  externalLinks: ExternalLink[];
  streaming: StreamingEntry[];
  fetchedAt: string;
}

export interface AnimeListEntry {
  malId: number;
  title: string;
  imageUrl: string | null;
  score: number | null;
  type: string | null;
  episodes: number | null;
  startDate: string | null;
  members: number | null;
}

export interface Genre {
  malId: number;
  name: string;
  url: string;
}

export const ANIME_PARSER_VERSION = 'anime-html-v2';

// Deliberately separate from ANIME_PARSER_VERSION even though both read anime pages. They used to
// share it, which meant a change to the shape of a *list* forced a refetch of every cached anime
// detail — a stampede against MyAnimeList for a change that touched neither. `AnimeListEntry` and
// `AnimeDetail` are different shapes produced by different parsers; they get different versions.
export const TOP_ANIME_PARSER_VERSION = 'top-anime-html-v1';
// v2: every seasonal entry carried `type: null`, so the cached rows are all missing a field that
// now has a value. Schedules read the same card parser and bump alongside it.
export const SEASON_PARSER_VERSION = 'season-html-v2';
