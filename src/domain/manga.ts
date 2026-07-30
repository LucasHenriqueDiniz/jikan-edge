import type { ImageSet } from './image';
import type { DateRange, ExternalLink, RelationEntry } from './anime';
import type { MalRef } from './mal-ref';

export interface MangaDetail {
  malId: number;
  url: string | null;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  titleSynonyms: string[];
  imageUrl: string | null;
  images: ImageSet;
  synopsis: string | null;
  background: string | null;
  type: string | null;
  volumes: number | null;
  chapters: number | null;
  status: string | null;
  publishing: boolean;
  published: DateRange;
  authors: MalRef[];
  // `serializations` is the array MAL's own page carries; the old singular `serialization` string
  // could only ever hold the first magazine.
  serializations: MalRef[];
  genres: MalRef[];
  themes: MalRef[];
  demographics: MalRef[];
  score: number | null;
  scoredBy: number | null;
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

export const MANGA_PARSER_VERSION = 'manga-html-v2';

// Same reasoning as TOP_ANIME_PARSER_VERSION: the top list is a different shape from the detail,
// and sharing one version coupled their invalidation for no reason.
export const TOP_MANGA_PARSER_VERSION = 'top-manga-html-v1';
