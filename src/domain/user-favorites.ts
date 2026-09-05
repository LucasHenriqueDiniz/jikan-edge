/**
 * A MyAnimeList profile's favourites, as this API serves them.
 *
 * Declared here rather than in `user-favorites.parser.ts`, where it grew, because
 * `FavoritesRepository` and the store port both name it: a repository importing a type from the
 * parser layer was the boundary violation this slice closes. The parser re-exports both names, so
 * every existing import path keeps resolving.
 *
 * `title` and `name` are both optional and exactly one is present per entry — anime and manga
 * favourites carry a title, characters and people carry a name. That is MyAnimeList's own split,
 * kept rather than flattened into one field that would lie about which it is.
 */
export interface Favorite {
  malId: number;
  title?: string;
  name?: string;
  url: string;
  type?: string;
  startYear?: number | null;
  imageUrl: string | null;
}

export interface Favorites {
  anime: Favorite[];
  manga: Favorite[];
  characters: Favorite[];
  people: Favorite[];
}
