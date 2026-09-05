import { ServiceError } from './errors';

interface Pagination {
  page: number;
  limit: number;
  count: number;
  total: number | null;
  hasNextPage: boolean;
}

// A page number past this is never a real request: MAL's own listings run out long before, and each
// distinct page fetched writes a cache row and costs an upstream request. Before this cap,
// `?page=500000` reached MyAnimeList for real — measured at 1.5s to 8.6s per call.
export const MAX_PAGE = 1000;
const MAX_LIMIT = 300;
const DEFAULT_LIMIT = 100;

// Regex first, on purpose. `Number.parseInt` silently accepts `1e9` as 1, `1.5` as 1 and ` 1` as 1,
// which is how `?page=abc` used to become page 1 without a word to the caller.
function positiveInteger(raw: string | undefined, name: string, max: number, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw))
    throw new ServiceError(`INVALID_${name}`, 400, `"${name.toLowerCase()}" must be a whole number.`);
  const value = Number(raw);
  if (value < 1 || value > max)
    throw new ServiceError(`INVALID_${name}`, 400, `"${name.toLowerCase()}" must be between 1 and ${max}.`);
  return value;
}

export function parsePageParam(raw: string | undefined): number {
  return positiveInteger(raw, 'PAGE', MAX_PAGE, 1);
}

export function parseLimitParam(raw: string | undefined): number {
  return positiveInteger(raw, 'LIMIT', MAX_LIMIT, DEFAULT_LIMIT);
}

// `total` is a number only where this API genuinely knows one — the user lists, counted in D1.
// Everything else is served one MyAnimeList page at a time, and MAL prints no total anywhere, so
// inventing one from `lastVisiblePage * perPage` would be a fabricated number in the `meta` of an
// API that just removed a field for being misleading.
export function paginationMeta(page: number, perPage: number, count: number, total: number | null = null): Pagination {
  return {
    page,
    limit: perPage,
    count,
    total,
    // Derived from fullness: a page that came back with MAL's own page size almost certainly has
    // another behind it. Cheap, and never costs the extra upstream request that checking would.
    hasNextPage: total === null ? count >= perPage : page * perPage < total,
  };
}
