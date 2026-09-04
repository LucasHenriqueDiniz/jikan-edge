import { z } from 'zod';
import { ParserError } from './html';

export interface SeasonArchiveEntry {
  year: number;
  seasons: string[];
}
export const SEASON_ARCHIVE_PARSER_VERSION = 'season-archive-html-v2';

const SEASON_ORDER = ['winter', 'spring', 'summer', 'fall'];
const entrySchema = z.object({ year: z.number().int().min(1900).max(2100), seasons: z.array(z.string()).min(1) });

export function parseSeasonArchive(html: string): SeasonArchiveEntry[] {
  const byYear = new Map<number, Set<string>>();
  for (const match of html.matchAll(
    /href="https:\/\/myanimelist\.net\/anime\/season\/(\d{4})\/(winter|spring|summer|fall)"/gi,
  )) {
    const year = Number(match[1]);
    if (!byYear.has(year)) byYear.set(year, new Set());
    byYear.get(year)!.add(match[2].toLowerCase());
  }
  const list = [...byYear.entries()]
    .map(([year, seasons]) => ({ year, seasons: SEASON_ORDER.filter((season) => seasons.has(season)) }))
    .sort((a, b) => b.year - a.year);
  const validated = z.array(entrySchema).safeParse(list);
  if (!validated.success || validated.data.length < 30) throw new ParserError('invalid_season_archive');
  return validated.data;
}
