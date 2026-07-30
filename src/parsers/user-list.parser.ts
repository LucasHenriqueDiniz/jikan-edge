import { z } from 'zod';
import type { MediaType, UserMediaListEntry } from '../domain/list-entry';
import { capture, numeric, ParserError } from './html';

const entrySchema = z.object({
  username: z.string().min(1), mediaType: z.enum(['anime', 'manga']), malId: z.number().int().positive(), title: z.string().min(1),
  imageUrl: z.string().url().nullable(), status: z.string().nullable(), score: z.number().nullable(), progress: z.number().nullable(), total: z.number().nullable(),
  startedAt: z.string().nullable(), finishedAt: z.string().nullable(), updatedAt: z.string().nullable(), fetchedAt: z.string().datetime(),
});

export interface ListCompletenessEvidence { declaredTotal: number | null; extractedTotal: number; uniqueTotal: number; sourceBytes: number; pageCount: number; terminalMarkerFound: boolean; duplicateIds: number[]; }
export type ListParseResult =
  | { kind: 'complete'; items: UserMediaListEntry[]; evidence: ListCompletenessEvidence }
  | { kind: 'empty'; items: []; evidence: ListCompletenessEvidence }
  | { kind: 'partial'; items: UserMediaListEntry[]; reason: string; evidence: ListCompletenessEvidence }
  | { kind: 'invalid'; reason: string; evidence: ListCompletenessEvidence };

export function parseUserMediaListSnapshot(html: string, username: string, mediaType: MediaType, fetchedAt = new Date().toISOString()): ListParseResult {
  const route = mediaType === 'anime' ? 'anime' : 'manga';
  const expression = new RegExp(`<a\\s+href="/${route}/(\\d+)/[^\"]*"[^>]*class="animetitle"[^>]*>[\\s\\S]{0,300}?<span>([\\s\\S]*?)<\\/span>`, 'gi');
  const entries = new Map<number, UserMediaListEntry>();
  let matchedItems = 0;
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
