/**
 * A MAL entity we know by name *and* by id, captured from an anchor's href.
 *
 * Genres, studios, themes, authors and demographics used to be plain `string[]`, which threw away
 * the id and URL sitting right there in the markup. Jikan models all of them as
 * `{mal_id, type, name, url}` and clients routinely filter on the id, so the parsers keep it now.
 */
export interface NamedRef {
  malId: number;
  name: string;
  url: string;
}
