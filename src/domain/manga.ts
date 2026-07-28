import type { ExternalLink, RelationEntry } from './anime';
import type { NamedRef } from './named-ref';

export interface MangaDetail {
  malId: number;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  imageUrl: string | null;
  synopsis: string | null;
  type: string | null;
  volumes: number | null;
  chapters: number | null;
  status: string | null;
  published: string | null;
  authors: NamedRef[];
  serialization: string | null;
  genres: NamedRef[];
  themes: NamedRef[];
  demographics: NamedRef[];
  score: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  favorites: number | null;
  relations: RelationEntry[];
  externalLinks: ExternalLink[];
  fetchedAt: string;
  sourceVersion: string;
}

export interface MangaListEntry {
  malId: number;
  title: string;
  imageUrl: string | null;
  score: number | null;
  type: string | null;
  volumes: number | null;
  startDate: string | null;
  members: number | null;
}

// v2: authors/genres/themes/demographics carry mal_id + url instead of bare names.
export const MANGA_PARSER_VERSION = 'manga-html-v2';
