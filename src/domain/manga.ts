import type { ExternalLink, RelationEntry } from './anime';

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
  authors: string[];
  serialization: string | null;
  genres: string[];
  themes: string[];
  demographics: string[];
  score: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  favorites: number | null;
  relations: RelationEntry[];
  externalLinks: ExternalLink[];
  fetchedAt: string;
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

export const MANGA_PARSER_VERSION = 'manga-html-v1';
