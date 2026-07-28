import type { JikanPagination } from './jikan/types';

/**
 * Our own signalling, kept alongside Jikan's envelope rather than inside it.
 *
 * Jikan has no equivalent — it can't tell you it served you a stale document after a failed
 * refresh. Clients written against Jikan ignore the extra key, so keeping it costs nothing and
 * losing it would throw away the one thing we know that upstream doesn't.
 */
export interface EdgeMeta {
  cached?: boolean;
  stale?: boolean;
  refreshFailed?: boolean;
  fetchedAt?: string;
}

export interface JikanEnvelope<T> {
  data: T;
  meta: EdgeMeta;
}

export interface JikanPagedEnvelope<T> {
  pagination: JikanPagination;
  data: T[];
  meta: EdgeMeta;
}

/** Collapses the `{cached, stale, refreshFailed, fetchedAt}` literal every handler repeats. */
export function metaOf(result: { cached: boolean; stale: boolean; refreshFailed: boolean; fetchedAt: string }): EdgeMeta {
  return { cached: result.cached, stale: result.stale, refreshFailed: result.refreshFailed, fetchedAt: result.fetchedAt };
}

export function ok<T>(data: T, meta: EdgeMeta): JikanEnvelope<T> {
  return { data, meta };
}

/** `pagination` is emitted before `data` to match Jikan's own key order. */
export function okPaged<T>(data: T[], pagination: JikanPagination, meta: EdgeMeta): JikanPagedEnvelope<T> {
  return { pagination, data, meta };
}

/**
 * Builds Jikan's pagination block, honestly.
 *
 * Two very different situations hide behind the same envelope:
 *
 * - We know the corpus size (`total` given): either D1 is paginating for us, or the route serves
 *   a single MAL document whose entries we counted in full. Real page maths applies.
 * - We served one MAL page and know nothing about what follows (`total` omitted). Then
 *   `items.total` is null and `has_next_page` is false. Reporting `total = count` would claim
 *   this is the whole corpus, and a speculative `has_next_page: true` would send paging clients
 *   into a loop past the end. Null is the only claim we can defend.
 */
export function paginationFrom(page: number, count: number, perPage: number, total?: number): JikanPagination {
  if (total === undefined) {
    return { last_visible_page: page, has_next_page: false, current_page: page, items: { count, total: null, per_page: perPage } };
  }
  return {
    last_visible_page: Math.max(1, Math.ceil(total / Math.max(1, perPage))),
    has_next_page: page * perPage < total,
    current_page: page,
    items: { count, total, per_page: perPage },
  };
}

/** A route that serves one complete MAL document: the count genuinely is the total. */
export function completePagination<T>(data: T[]): JikanPagination {
  return paginationFrom(1, data.length, Math.max(1, data.length), data.length);
}

/** A route that serves one MAL page out of an unknown number. */
export function onePagePagination<T>(data: T[], page: number): JikanPagination {
  return paginationFrom(page, data.length, Math.max(1, data.length));
}

/** A list route whose payload is one complete MAL document. */
export function okList<T>(data: T[], meta: EdgeMeta): JikanPagedEnvelope<T> {
  return okPaged(data, completePagination(data), meta);
}

/** A list route serving page `page` of an upstream corpus whose size we don't know. */
export function okPage<T>(data: T[], page: number, meta: EdgeMeta): JikanPagedEnvelope<T> {
  return okPaged(data, onePagePagination(data, page), meta);
}
