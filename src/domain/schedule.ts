import type { AnimeListEntry } from './anime';

/**
 * The buckets the broadcast schedule is grouped into. `other` and `unknown` are MyAnimeList's own
 * two extra headings, not a fallback invented here.
 *
 * The const moved with the type rather than the union being spelled out in the domain. Spelling it
 * out would have broken the link that keeps the two honest — the parser iterates `SCHEDULE_DAYS` to
 * build the object, and `query-contract.ts` validates `?filter=` against it, so a day added to one
 * and not the other would compile.
 */
export const SCHEDULE_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'other',
  'unknown',
] as const;

export type ScheduleDay = (typeof SCHEDULE_DAYS)[number];

/** Contract note: `GET /v1/schedules` without a filter returns this object, not a flattened list. */
export type ScheduleByDay = Record<ScheduleDay, AnimeListEntry[]>;
