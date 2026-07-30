export const GENRE_KINDS = ['genres', 'explicit_genres', 'themes', 'demographics'] as const;

export type GenreKind = (typeof GENRE_KINDS)[number];

export interface GenreTaxonomyEntry {
  malId: number;
  name: string;
  url: string;
  count: number;
  type: GenreKind;
}

// Separate from ANIME_PARSER_VERSION/MANGA_PARSER_VERSION so switching the taxonomy source only
// invalidates the two genre rows instead of forcing a refetch of the whole catalog.
export const GENRE_PARSER_VERSION = 'genre-taxonomy-v2';
