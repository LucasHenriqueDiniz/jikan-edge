import { z } from 'zod';
import type { AnimeSearchEntry, MangaSearchEntry } from '../domain/search';
import { decodeHtml, imageFrom, numeric } from './html';

const baseShape = {
  malId: z.number().int().positive(),
  url: z.string().url(),
  title: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  synopsis: z.string().nullable(),
  type: z.string().nullable(),
  score: z.number().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  members: z.number().nullable(),
};

export const animeSchema = z.object({ ...baseShape, episodes: z.number().nullable(), rating: z.string().nullable() });
export const mangaSchema = z.object({ ...baseShape, volumes: z.number().nullable(), chapters: z.number().nullable() });

/**
 * A results-table date: `MM-DD-YY`, no century, `??` for an unknown part and `-` for none.
 *
 * A part MAL does not know is dropped from the end rather than the whole date: `10-??-27` (an
 * announced October 2027) is `2027-10`, and `??-??-27` is `2027` — ISO 8601's reduced precision,
 * the same thing MAL is saying. Returning null threw away the month and year it did print.
 *
 * Search lists upcoming titles, so the pivot cannot be "this year" the way the user lists use it:
 * a two-digit year up to five past the current one is read as 20YY, anything above as 19YY. The cost
 * of that is a known ambiguity rather than a hidden one — MAL's handful of titles from 1917 to 1931
 * share their two digits with 2017 to 2031 and come out in the 2000s. The detail page has the full
 * date; this column does not.
 */
export function resultDate(cell: string | null, now = new Date()): string | null {
  const match = (cell ?? '').trim().match(/^(\d{2}|\?\?)-(\d{2}|\?\?)-(\d{2})$/);
  if (!match) return null;
  const [, month, day, shortYear] = match;
  const pivot = (now.getUTCFullYear() + 5) % 100;
  const year = Number(shortYear) <= pivot ? 2000 + Number(shortYear) : 1900 + Number(shortYear);
  if (month === '??') return String(year);
  if (day === '??') return Number(month) >= 1 && Number(month) <= 12 ? `${year}-${month}` : null;
  const iso = `${year}-${month}-${day}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

// The column headers in their order, minus Title — which is the one header without a matching
// `bgColor` data cell. The table carries whatever columns the request asked for (`c[]=`, see
// searchUrl), and the manga table puts Chapters *between* Volumes and Score, so reading cells by a
// fixed position would publish chapters as the score. By name, each value lands where it belongs.
function columnNames(html: string): string[] {
  return [...html.matchAll(/<td class="borderClass bgColor1 ac fw-b"[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((name) => name !== 'Title');
}

// The table without the extra columns, for a page that somehow did not carry a header row: the three
// cells MAL always shows.
const DEFAULT_COLUMNS = { anime: ['Type', 'Eps.', 'Score'], manga: ['Type', 'Vol.', 'Score'] };

function parseCard<T>(chunk: string, media: 'anime' | 'manga', columns: string[], schema: z.ZodType<T>): T | null {
  // Each real result row contains two "sarea{id}" markers (the image link, and an empty
  // hover-preview div right before the title) — matching either is fine since both carry the
  // same id, but the row must be split on a boundary that keeps the image, title, and the
  // type/count/score cells together (see splitRows).
  const idMatch = chunk.match(/id="sarea(\d+)"/);
  if (!idMatch) return null;
  const malId = Number(idMatch[1]);
  const href = chunk.match(new RegExp(`href="(https://myanimelist\\.net/${media}/${malId}/[^"]*)"`, 'i'))?.[1];
  const title = decodeHtml(chunk.match(/<strong>([^<]+)<\/strong>/i)?.[1] ?? '');
  const synopsisRaw = chunk.match(/class="pt4">([\s\S]*?)<a\s/i)?.[1] ?? null;
  const synopsis = synopsisRaw
    ? decodeHtml(synopsisRaw)
        .replace(/\s*read more\.?$/i, '')
        .replace(/\.{3}$/, '')
        .trim() || null
    : null;
  const cells = [...chunk.matchAll(/<td class="borderClass ac bgColor\d"[^>]*>\s*([\s\S]*?)\s*<\/td>/gi)].map((match) =>
    decodeHtml(match[1]),
  );
  const cell = (name: string): string | null => {
    const index = columns.indexOf(name);
    const value = index === -1 ? null : (cells[index] ?? null);
    return value && value !== '-' ? value : null;
  };
  const shared = {
    malId,
    // The row already links the entry with its slug; falling back to the slugless form keeps a
    // usable link when MAL changes the anchor rather than dropping the field.
    url: href ?? `https://myanimelist.net/${media}/${malId}`,
    title,
    imageUrl: imageFrom(chunk),
    synopsis,
    type: cell('Type'),
    score: numeric(cell('Score')),
    startDate: resultDate(cell('Start Date')),
    endDate: resultDate(cell('End Date')),
    members: numeric(cell('Members')),
  };
  const candidate =
    media === 'anime'
      ? { ...shared, episodes: numeric(cell('Eps.')), rating: cell('Rated') }
      : { ...shared, volumes: numeric(cell('Vol.')), chapters: numeric(cell('Chap.')) };
  const parsed = schema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function splitRows(html: string): string[] {
  return html.split('<tr>').slice(1);
}

function parseResults<T>(html: string, media: 'anime' | 'manga', schema: z.ZodType<T>): T[] {
  const named = columnNames(html);
  const columns = named.length > 0 ? named : DEFAULT_COLUMNS[media];
  return splitRows(html)
    .map((chunk) => parseCard(chunk, media, columns, schema))
    .filter((entry): entry is T => entry !== null);
}

export function parseAnimeSearchResults(html: string): AnimeSearchEntry[] {
  return parseResults(html, 'anime', animeSchema);
}

export function parseMangaSearchResults(html: string): MangaSearchEntry[] {
  return parseResults(html, 'manga', mangaSchema);
}
