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

export interface ListCompletenessEvidence { declaredTotal: number | null; extractedTotal: number; uniqueTotal: number; sourceBytes: number; pageCount: number; terminalMarkerFound: boolean; duplicateIds: number[]; }
export type ListParseResult =
  | { kind: 'complete'; items: UserMediaListEntry[]; evidence: ListCompletenessEvidence }
  | { kind: 'empty'; items: []; evidence: ListCompletenessEvidence }
  | { kind: 'partial'; items: UserMediaListEntry[]; reason: string; evidence: ListCompletenessEvidence }
  | { kind: 'invalid'; reason: string; evidence: ListCompletenessEvidence };

export function listLayout(html: string): ListLayout {
  return /data-items="/.test(html) ? 'modern' : 'classic';
}

/** Only `&quot;` has to go before `JSON.parse` — MAL escapes an in-title quote as `\&quot;`, which decodes to
 *  valid JSON escaping. The rest are decoded per string value afterwards, so a literal `&amp;quot;` in a title
 *  cannot turn into a delimiter. `&amp;` goes last, or it would re-introduce the other entities. */
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
      title: typeof title === 'string' ? decodeEntities(title).trim() : '',
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
  for (const match of html.matchAll(expression)) {
    matchedItems += 1;
    const malId = Number(match[1]);
    const title = match[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
    const start = match.index ?? 0; const context = html.slice(Math.max(0, start - 1_500), start + 1_500);
    const imageUrl = capture(context, /<img[^>]+(?:data-src|src)="([^"]+)"/i);
    const score = numeric(capture(context, /score-label[^>]*>\s*([\d.]+)\s*</i));
    const progress = numeric(capture(context, /<td[^>]*>\s*(\d+)\s*<\/td>/i));
    const candidate: UserMediaListEntry = { username, mediaType, malId, title, imageUrl, status: null, score, progress, total: null, startedAt: null, finishedAt: null, updatedAt: null, fetchedAt };
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
  return { declaredTotal: null, extractedTotal, uniqueTotal: entries.size, sourceBytes: new TextEncoder().encode(html).byteLength, pageCount: 1, terminalMarkerFound: /<\/html>\s*$/i.test(html), duplicateIds };
}

export function parseUserMediaList(html: string, username: string, mediaType: MediaType, fetchedAt = new Date().toISOString()): UserMediaListEntry[] {
  const result = parseUserMediaListSnapshot(html, username, mediaType, fetchedAt);
  if (result.kind !== 'complete') throw new ParserError(result.kind === 'empty' ? 'empty_list_without_explicit_empty_marker' : result.reason);
  return result.items;
}
