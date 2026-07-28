import type { NamedRef } from './named-ref';

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

export interface AnimeDetail {
  malId: number;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  imageUrl: string | null;
  synopsis: string | null;
  type: string | null;
  episodes: number | null;
  status: string | null;
  aired: string | null;
  studios: NamedRef[];
  genres: NamedRef[];
  themes: NamedRef[];
  duration: string | null;
  rating: string | null;
  score: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  favorites: number | null;
  source: string | null;
  relations: RelationEntry[];
  externalLinks: ExternalLink[];
  streaming: StreamingEntry[];
  fetchedAt: string;
  sourceVersion: string;
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

// v2: studios/genres/themes carry mal_id + url instead of bare names.
export const ANIME_PARSER_VERSION = 'anime-html-v2';
