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

// v2: a genre-only search on page 1 was cached as an empty list, because MAL redirected that URL to
// the genre-browse page and the parser found no rows there. The bump is what stops those empty rows
// from being served for the rest of their TTL now that the URL keeps the search on the search page.
export const ANIME_SEARCH_PARSER_VERSION = 'anime-search-html-v2';
export const MANGA_SEARCH_PARSER_VERSION = 'manga-search-html-v2';
