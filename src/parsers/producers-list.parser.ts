import { z } from 'zod';
import type { ProducerListEntry } from '../domain/producer-list';
import { decodeHtml, numeric, ParserError } from './html';

const entrySchema = z.object({ malId: z.number().int().positive(), name: z.string().min(1), count: z.number().int().min(0), url: z.string().url() });

// The real producer directory has ~900 entries. Same defensive floor as magazines/genres: reject
// an implausibly short result rather than caching a reduced page as complete.
const MIN_EXPECTED_PRODUCERS = 300;

const PRODUCER_PATTERN = /<a href="\/anime\/producer\/(\d+)\/[^"]*" class="genre-name-link">([^(<]+)\((\d+)\)<\/a>/gi;

export function parseProducersList(html: string): ProducerListEntry[] {
  const producers = new Map<number, ProducerListEntry>();
  for (const match of html.matchAll(PRODUCER_PATTERN)) {
    const malId = Number(match[1]);
    if (producers.has(malId)) continue;
    const name = decodeHtml(match[2]);
    producers.set(malId, { malId, name, count: numeric(match[3]) ?? 0, url: `https://myanimelist.net/anime/producer/${malId}` });
  }
  const list = [...producers.values()].sort((a, b) => a.malId - b.malId);
  const validated = z.array(entrySchema).safeParse(list);
  if (!validated.success || validated.data.length < MIN_EXPECTED_PRODUCERS) throw new ParserError('invalid_producer_list');
  return validated.data;
}
