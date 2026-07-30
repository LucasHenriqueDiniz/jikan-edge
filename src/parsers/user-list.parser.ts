import { z } from 'zod';
import type { MediaType, UserMediaListEntry } from '../domain/list-entry';
import { capture, numeric, ParserError } from './html';

const entrySchema = z.object({
  username: z.string().min(1), mediaType: z.enum(['anime', 'manga']), malId: z.number().int().positive(), title: z.string().min(1),
  imageUrl: z.string().url().nullable(), status: z.string().nullable(), score: z.number().nullable(), progress: z.number().nullable(), total: z.number().nullable(),
  startedAt: z.string().nullable(), finishedAt: z.string().nullable(), updatedAt: z.string().nullable(), fetchedAt: z.string().datetime(),
});

/** MAL serves the modern list in blocks of 300; a full block means another page may follow. */
export const LIST_PAGE_SIZE = 300;

/**
 * MAL renders a user's list in one of two layouts, chosen by the user's own settings:
 * `classic` is a server-rendered table (`class="animetitle"` anchors), `modern` embeds the entries as a
 * JSON array inside a `data-items` attribute. Only the classic one used to be read, so every modern-layout
 * user matched zero rows and the completeness guard rejected the snapshot with a 502.
 */
export type ListLayout = 'classic' | 'modern';

/**
 * Per-page evidence only. There is deliberately no `declaredTotal` here: MAL's list page never states how
 * many entries the list holds — the counters beside "All Anime" are drawn by JS — so the field could only
 * ever be null and read as if completeness had been checked. The real cross-check lives in the service,
 * which compares the assembled list against the profile's own counter.
 */
export interface ListCompletenessEvidence { extractedTotal: number; uniqueTotal: number; sourceBytes: number; pageCount: number; terminalMarkerFound: boolean; duplicateIds: number[]; }
export type ListParseResult =
  | { kind: 'complete'; items: UserMediaListEntry[]; evidence: ListCompletenessEvidence }
  | { kind: 'empty'; items: []; evidence: ListCompletenessEvidence }
  | { kind: 'partial'; items: UserMediaListEntry[]; reason: string; evidence: ListCompletenessEvidence }
  | { kind: 'invalid'; reason: string; evidence: ListCompletenessEvidence };

export function listLayout(html: string): ListLayout {
  return /data-items="/.test(html) ? 'modern' : 'classic';
}

/** Used by both layouts. Only `&quot;` has to go before `JSON.parse` — MAL escapes an in-title quote as
 *  `\&quot;`, which decodes to valid JSON escaping. The rest are decoded per string value afterwards, so a
 *  literal `&amp;quot;` in a title cannot turn into a delimiter. `&amp;` goes last, or it would re-introduce
 *  the other entities. The classic path used to decode `&amp;` alone, so titles reached the API still holding
 *  `&quot;` and `&#039;` — 16 of AMayacrab's 227 manga titles. */
function decodeEntities(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** MAL prints list dates as `MM-DD-YY` with no century. Pivot on the current year: `10` is 2010, `98` is 1998. */
function listDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, month, day, shortYear] = match;
  const pivot = new Date().getUTCFullYear() % 100;
  const year = Number(shortYear) <= pivot ? 2000 + Number(shortYear) : 1900 + Number(shortYear);
  const iso = `${year}-${month}-${day}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/**
 * A title that reads as a number arrives as a JSON *number*, not a string — MAL does not quote it. Real cases
 * on one list alone: `86` (86 Eighty-Six), `1`, `663114`. Treating only strings as titles emptied those rows,
 * and one empty title failed the schema and took the entire snapshot down with it.
 */
function text(value: unknown): string {
  if (typeof value === 'string') return decodeEntities(value).trim();
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

/** Zero is MAL's "unset" for score, episode count and chapter count alike — not a real value. */
function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

const STATUS_NAMES: Record<number, [anime: string, manga: string]> = {
  1: ['watching', 'reading'], 2: ['completed', 'completed'], 3: ['on hold', 'on hold'],
  4: ['dropped', 'dropped'], 6: ['plan to watch', 'plan to read'],
};

function modernEntries(html: string, username: string, mediaType: MediaType, fetchedAt: string): UserMediaListEntry[] | null {
  // Deliberately not `capture()`: it runs `decodeHtml`, which decodes `&amp;` before `&quot;`, strips anything
  // shaped like a tag and collapses runs of whitespace — all three would silently corrupt a JSON payload
  // (a title containing `<` would simply lose part of itself). The attribute has to arrive raw.
  const raw = /data-items="([^"]*)"/i.exec(html)?.[1];
  if (raw === undefined) return null;
  let items: unknown;
  try { items = JSON.parse(raw.replace(/&quot;/g, '"')); } catch { return null; }
  if (!Array.isArray(items)) return null;
  const prefix = mediaType === 'anime' ? 'anime' : 'manga';
  return items.map((item) => {
    const row = item as Record<string, unknown>;
    const title = row[`${prefix}_title`];
    const image = row[`${prefix}_image_path`];
    const statusPair = STATUS_NAMES[Number(row.status)];
    return {
      username, mediaType,
      malId: Number(row[`${prefix}_id`]),
      title: text(title),
      imageUrl: typeof image === 'string' && image.length > 0 ? decodeEntities(image) : null,
      status: statusPair ? (mediaType === 'anime' ? statusPair[0] : statusPair[1]) : null,
      score: positive(row.score),
      progress: mediaType === 'anime' ? positive(row.num_watched_episodes) : positive(row.num_read_chapters),
      total: mediaType === 'anime' ? positive(row.anime_num_episodes) : positive(row.manga_num_chapters),
      startedAt: listDate(row.start_date_string),
      finishedAt: listDate(row.finish_date_string),
      updatedAt: typeof row.updated_at === 'number' && row.updated_at > 0 ? new Date(row.updated_at * 1000).toISOString() : null,
      fetchedAt,
    };
  });
}

/**
 * The classic table gives every entry its own `<table>`, and that table opens with a plain row-number cell
 * (`<td align="center" width="30">1</td>`, restarting at 1 per status group). A window that started 1.5 KB
 * *before* the title anchor therefore read that counter — or a neighbouring row's cell — as the progress:
 * 311 of AMayacrab's 360 anime rows came out wrong (Accel World reported 1 episode instead of 16).
 * Bound the row by its own `<table>`, never crossing into the previous or next entry.
 */
function classicRow(html: string, anchors: RegExpExecArray[] | RegExpMatchArray[], index: number): string {
  const start = anchors[index]?.index ?? 0;
  const previous = index === 0 ? 0 : (anchors[index - 1]?.index ?? 0);
  const next = anchors[index + 1]?.index ?? html.length;
  // Fall back to the anchor itself if this layout has no per-row table to hang the window on: reading a
  // little less of the row is recoverable, reading the row above it is what produced the wrong numbers.
  const opening = html.lastIndexOf('<table', start);
  const closing = html.indexOf('</table>', start);
  return html.slice(opening > previous ? opening : start, closing === -1 ? next : Math.min(closing, next));
}

/**
 * MAL renders the progress cell two ways, and only one of them carries a total:
 *   `<span id="output918">101</span>/201` — anything still in progress; either side can be `-` (unknown
 *   total on an airing series, no episodes watched on a plan-to-watch entry).
 *   `12` — bare, used only for completed entries, where watched equals the total. Verified against the
 *   source: Acchi Kocchi renders `12` and the anime has 12 episodes; A Returner's Magic renders `268`
 *   against 268 chapters.
 * The span id is not a reliable key — anime uses the MAL id (`output918`), manga the list-entry id
 * (`chap169785032`) — so match the cell, not the id. `width="70"` is what distinguishes the progress
 * column from the row number (30), score (45), type (50), tags (125) and priority (80).
 */
function classicProgress(row: string): { progress: number | null; total: number | null } {
  const counted = /<span id="(?:output|chap)\d+">\s*([^<]*?)\s*<\/span>\s*\/\s*([^\s<]*)/i.exec(row);
  if (counted) return { progress: dash(counted[1]), total: dash(counted[2]) };
  const complete = numeric(/<td[^>]*width="70"[^>]*>\s*([\d,]+)\s*<\/td>/i.exec(row)?.[1] ?? null);
  return { progress: complete, total: complete };
}

/** MAL writes an unknown count as `-`. `numeric` already rejects that, but `Number('')` is `0`, so an empty
 *  cell would otherwise be served as a real zero instead of "not stated". */
function dash(value: string | undefined): number | null {
  return value === undefined || value === '-' || value === '' ? null : numeric(value);
}

export function parseUserMediaListSnapshot(html: string, username: string, mediaType: MediaType, fetchedAt = new Date().toISOString()): ListParseResult {
  const route = mediaType === 'anime' ? 'anime' : 'manga';
  const entries = new Map<number, UserMediaListEntry>();
  let matchedItems = 0;

  const modern = modernEntries(html, username, mediaType, fetchedAt);
  if (modern !== null) {
    for (const candidate of modern) {
      matchedItems += 1;
      const parsed = entrySchema.safeParse(candidate);
      if (!parsed.success) return { kind: 'invalid', reason: 'invalid_list_item', evidence: evidence(html, matchedItems, entries, []) };
      entries.set(candidate.malId, parsed.data);
    }
    return finalize(html, matchedItems, entries);
  }

  const expression = new RegExp(`<a\\s+href="/${route}/(\\d+)/[^\"]*"[^>]*class="animetitle"[^>]*>[\\s\\S]{0,300}?<span>([\\s\\S]*?)<\\/span>`, 'gi');
  const anchors = [...html.matchAll(expression)];
  for (const [index, match] of anchors.entries()) {
    matchedItems += 1;
    const malId = Number(match[1]);
    const title = decodeEntities(match[2].replace(/<[^>]+>/g, '')).trim();
    const row = classicRow(html, anchors, index);
    const imageUrl = capture(row, /<img[^>]+(?:data-src|src)="([^"]+)"/i);
    const score = numeric(capture(row, /score-label[^>]*>\s*([\d.]+)\s*</i));
    const { progress, total } = classicProgress(row);
    const candidate: UserMediaListEntry = { username, mediaType, malId, title, imageUrl, status: null, score, progress, total, startedAt: null, finishedAt: null, updatedAt: null, fetchedAt };
    const parsed = entrySchema.safeParse(candidate);
    if (!parsed.success) return { kind: 'invalid', reason: 'invalid_list_item', evidence: evidence(html, matchedItems, entries, []) };
    entries.set(malId, parsed.data);
  }
  return finalize(html, matchedItems, entries);
}

function finalize(html: string, matchedItems: number, entries: Map<number, UserMediaListEntry>): ListParseResult {
  const duplicateIds = matchedItems === entries.size ? [] : [...entries.keys()];
  const resultEvidence = evidence(html, matchedItems, entries, duplicateIds);
  if (matchedItems !== entries.size) return { kind: 'invalid', reason: 'duplicate_ids', evidence: resultEvidence };
  if (entries.size === 0) return { kind: 'partial', items: [], reason: 'empty_list_without_explicit_empty_marker', evidence: resultEvidence };
  if (!resultEvidence.terminalMarkerFound) return { kind: 'partial', items: [...entries.values()], reason: 'terminal_marker_missing', evidence: resultEvidence };
  return { kind: 'complete', items: [...entries.values()], evidence: resultEvidence };
}

function evidence(html: string, extractedTotal: number, entries: Map<number, UserMediaListEntry>, duplicateIds: number[]): ListCompletenessEvidence {
  return { extractedTotal, uniqueTotal: entries.size, sourceBytes: new TextEncoder().encode(html).byteLength, pageCount: 1, terminalMarkerFound: /<\/html>\s*$/i.test(html), duplicateIds };
}

export function parseUserMediaList(html: string, username: string, mediaType: MediaType, fetchedAt = new Date().toISOString()): UserMediaListEntry[] {
  const result = parseUserMediaListSnapshot(html, username, mediaType, fetchedAt);
  if (result.kind !== 'complete') throw new ParserError(result.kind === 'empty' ? 'empty_list_without_explicit_empty_marker' : result.reason);
  return result.items;
}
