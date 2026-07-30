import { GENRE_KINDS, type GenreKind } from '../domain/genre';
import { ServiceError } from './cacheable';

// Jikan exposes the taxonomy categories through `?filter=`; the whole list is one cached document
// here, so the filter is applied on read instead of changing what gets fetched.
export function parseGenreFilter(raw: string | undefined): GenreKind | null {
  if (raw === undefined || raw === '') return null;
  const kind = GENRE_KINDS.find((candidate) => candidate === raw);
  if (!kind) throw new ServiceError('INVALID_FILTER', 400, `"filter" must be one of: ${GENRE_KINDS.join(', ')}.`);
  return kind;
}
