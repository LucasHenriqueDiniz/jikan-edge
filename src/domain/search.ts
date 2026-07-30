interface SearchEntryBase {
  malId: number;
  url: string;
  title: string;
  imageUrl: string | null;
  synopsis: string | null;
  type: string | null;
  score: number | null;
}

export interface AnimeSearchEntry extends SearchEntryBase {
  episodes: number | null;
}

// MAL's manga results table has the same three columns as the anime one, but the middle column is
// **volumes**, not episodes — verified against the detail pages: Fullmetal Alchemist shows `27` in
// search, and its detail page reads 27 volumes / 116 chapters. Sharing one shape between the two
// searches meant every completed manga published its volume count under `episodes`.
export interface MangaSearchEntry extends SearchEntryBase {
  volumes: number | null;
}

export type SearchEntry = AnimeSearchEntry | MangaSearchEntry;

export const ANIME_SEARCH_PARSER_VERSION = 'anime-search-html-v1';
export const MANGA_SEARCH_PARSER_VERSION = 'manga-search-html-v1';
