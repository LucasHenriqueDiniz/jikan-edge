import { ServiceError } from './cacheable';

/**
 * The preliminary and spoiler toggles of MAL's review pages, as query params MAL itself filters on.
 *
 * Both pages accept `preliminary=on|off` and `spoiler=on|off` (measured 2026-10-11): on One Piece,
 * `preliminary=off` returns no reviews at all, and on the global feed `preliminary=off&spoiler=on`
 * swaps 12 of the 50 cards. MAL's own defaults are preliminary **on** and spoiler **off**, and that
 * is what a request without either param still gets — unchanged from before these were supported.
 * Jikan documents the opposite preliminary default; following it would empty every airing show's
 * reviews for callers who never asked for that.
 */
export interface ReviewFilter {
  /** Extra MAL params, empty when the caller passed neither toggle. */
  params: [string, string][];
  /** Cache-key suffix; empty for the default so existing rows keep their keys. */
  key: string;
}

function toggle(raw: string | undefined, name: string): boolean | undefined {
  if (raw === undefined) return undefined;
  const value = raw.toLowerCase();
  if (value === '' || value === 'true') return true;
  if (value === 'false') return false;
  throw new ServiceError('INVALID_FILTER', 400, `"${name}" must be "true" or "false".`);
}

export function parseReviewFilter(rawPreliminary: string | undefined, rawSpoilers: string | undefined): ReviewFilter {
  const preliminary = toggle(rawPreliminary, 'preliminary');
  const spoilers = toggle(rawSpoilers, 'spoilers');
  if (preliminary === undefined && spoilers === undefined) return { params: [], key: '' };
  // Both are sent once either is, the way MAL's own pager links send them, with the one the caller
  // did not name at MAL's default. What MAL does with a lone toggle was not measured, so the request
  // never depends on it.
  const resolvedPreliminary = preliminary ?? true;
  const resolvedSpoilers = spoilers ?? false;
  return {
    params: [
      ['preliminary', resolvedPreliminary ? 'on' : 'off'],
      ['spoiler', resolvedSpoilers ? 'on' : 'off'],
    ],
    key: `:preliminary:${resolvedPreliminary}:spoilers:${resolvedSpoilers}`,
  };
}
