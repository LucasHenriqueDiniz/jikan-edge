import { ServiceError } from './cacheable';

// MyAnimeList ignores an unrecognised ranking tab silently: `topanime.php?type=bogus` answers 200
// with the unfiltered list. Handing the value straight through would therefore turn `?filter=bogus`
// into a wrong list dressed as a correct one — the exact failure mode the query guard exists to
// remove. So the allowed set is enforced here, and it differs by media: see TOP_ANIME_FILTERS and
// TOP_MANGA_FILTERS in mal-urls.ts for the measurement behind that difference.
export function parseTopFilter(raw: string | undefined, allowed: readonly string[]): string | null {
  if (raw === undefined || raw === '') return null;
  const filter = raw.toLowerCase();
  if (!allowed.includes(filter)) {
    throw new ServiceError('INVALID_FILTER', 400, `"filter" must be one of: ${allowed.join(', ')}.`);
  }
  return filter;
}
