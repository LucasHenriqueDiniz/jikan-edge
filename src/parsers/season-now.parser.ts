import { z } from 'zod';
import type { AnimeListEntry } from '../domain/anime';
import { decodeHtml, numeric, ParserError } from './html';

const entrySchema = z.object({
  malId: z.number().int().positive(), title: z.string().min(1), imageUrl: z.string().url().nullable(), score: z.number().nullable(),
  type: z.string().nullable(), episodes: z.number().nullable(), startDate: z.string().nullable(), members: z.number().nullable(),
});

export interface SeasonCompletenessEvidence { extractedTotal: number; sourceBytes: number; terminalMarkerFound: boolean; duplicateIds: number[]; }
export type SeasonParseResult =
  | { kind: 'complete'; items: AnimeListEntry[]; evidence: SeasonCompletenessEvidence }
  | { kind: 'partial'; items: AnimeListEntry[]; reason: string; evidence: SeasonCompletenessEvidence }
  | { kind: 'invalid'; reason: string; evidence: SeasonCompletenessEvidence };

const CARD_MARKER = 'js-seasonal-anime';

function cardChunks(html: string): string[] {
  return html.split(CARD_MARKER).slice(1);
}

function parseCard(chunk: string): AnimeListEntry | null {
  const link = chunk.match(/<a href="https:\/\/myanimelist\.net\/anime\/(\d+)\/[^"]*" class="link-title">([^<]+)<\/a>/i);
  if (!link) return null;
  const candidate = {
    malId: Number(link[1]),
    title: decodeHtml(link[2]),
    imageUrl: chunk.match(/data-src="([^"]+)"/i)?.[1] ?? null,
    score: numeric(chunk.match(/class="js-score">([\d.]+)<\/span>/i)?.[1] ?? null),
    type: null,
    episodes: numeric(chunk.match(/<span>(\d+)\s*eps?<\/span>/i)?.[1] ?? null),
    startDate: chunk.match(/class="js-start_date">(\d+)<\/span>/i)?.[1] ?? null,
    members: numeric(chunk.match(/class="js-members">(\d+)<\/span>/i)?.[1] ?? null),
  };
  const parsed = entrySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function parseSeasonNowSnapshot(html: string): SeasonParseResult {
  const entries = new Map<number, AnimeListEntry>();
  let matched = 0;
  for (const chunk of cardChunks(html)) {
    const parsed = parseCard(chunk);
    if (!parsed) continue;
    matched += 1;
    entries.set(parsed.malId, parsed);
  }
  const duplicateIds = matched === entries.size ? [] : [...entries.keys()];
  const evidence: SeasonCompletenessEvidence = { extractedTotal: matched, sourceBytes: new TextEncoder().encode(html).byteLength, terminalMarkerFound: /<\/html>\s*$/i.test(html), duplicateIds };
  if (entries.size === 0) return { kind: 'invalid', reason: 'no_seasonal_entries_found', evidence };
  if (!evidence.terminalMarkerFound) return { kind: 'partial', items: [...entries.values()], reason: 'terminal_marker_missing', evidence };
  return { kind: 'complete', items: [...entries.values()], evidence };
}

export function parseSeasonNow(html: string): AnimeListEntry[] {
  const result = parseSeasonNowSnapshot(html);
  if (result.kind !== 'complete') throw new ParserError(result.reason);
  return result.items;
}

// Extracts seasonal cards from an HTML fragment without the whole-document completeness checks —
// used by the day-grouped schedule parser, which slices the page into per-day sections first.
export function parseSeasonalEntries(fragment: string): AnimeListEntry[] {
  const entries = new Map<number, AnimeListEntry>();
  for (const chunk of cardChunks(fragment)) {
    const parsed = parseCard(chunk);
    if (parsed) entries.set(parsed.malId, parsed);
  }
  return [...entries.values()];
}
