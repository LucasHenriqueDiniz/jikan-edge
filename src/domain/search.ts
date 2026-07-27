export interface SearchEntry {
  malId: number;
  title: string;
  imageUrl: string | null;
  synopsis: string | null;
  type: string | null;
  episodes: number | null;
  score: number | null;
}

export const SEARCH_PARSER_VERSION = 'search-html-v1';
