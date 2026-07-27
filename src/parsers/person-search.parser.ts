import { z } from 'zod';
import type { PersonSearchResult } from '../domain/person-search';
import { decodeHtml, ParserError } from './html';

const entrySchema = z.object({ malId: z.number().int().positive(), name: z.string().min(1), url: z.string().url(), imageUrl: z.string().url().nullable() });

export function parsePersonSearch(html: string): PersonSearchResult[] {
  if (html.includes('No results returned')) return [];
  const results: PersonSearchResult[] = [];
  for (const block of html.split('<tr>').slice(1)) {
    const idMatch = block.match(/(?:https:\/\/myanimelist\.net)?\/people\/(\d+)\/([^"]*)"/i);
    if (!idMatch) continue;
    const malId = Number(idMatch[1]);
    const name = decodeHtml(block.match(/\/people\/\d+\/[^"]*">([^<]+)<\/a>/i)?.[1] ?? '');
    const imageUrl = block.match(/data-src="([^"]+)"/i)?.[1] ?? null;
    const candidate = { malId, name, url: `https://myanimelist.net/people/${malId}/${idMatch[2]}`, imageUrl };
    const parsed = entrySchema.safeParse(candidate);
    if (parsed.success) results.push(parsed.data);
  }
  if (results.length === 0) throw new ParserError('empty_person_search_page');
  return results;
}
