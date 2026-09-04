import type { AnimeListEntry } from '../domain/anime';
import { ParserError } from './html';
import { parseSeasonalEntries } from './season-now.parser';

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
export type ScheduleByDay = Record<ScheduleDay, AnimeListEntry[]>;
// v4: the shared seasonal card parser started emitting `type`, which was null on every entry here
// too — the schedule reuses the same cards, one day heading at a time.
export const SCHEDULE_PARSER_VERSION = 'schedule-html-v4';

export function parseScheduleByDay(html: string): ScheduleByDay {
  const result = Object.fromEntries(SCHEDULE_DAYS.map((day) => [day, []])) as unknown as ScheduleByDay;
  const sections = html.split('class="anime-header">');
  let total = 0;
  for (const section of sections.slice(1)) {
    const day = section
      .slice(0, 40)
      .match(/^([A-Za-z]+)</)?.[1]
      ?.toLowerCase() as ScheduleDay | undefined;
    if (!day || !SCHEDULE_DAYS.includes(day)) continue;
    const entries = parseSeasonalEntries(section);
    result[day] = entries;
    total += entries.length;
  }
  if (total === 0) throw new ParserError('empty_schedule_page');
  return result;
}
