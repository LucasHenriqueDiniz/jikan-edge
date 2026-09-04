import { z } from 'zod';
import type { CharacterSearchResult } from '../domain/character-search';
import { decodeHtml, imageFrom, ParserError } from './html';

const entrySchema = z.object({
  malId: z.number().int().positive(),
  name: z.string().min(1),
  url: z.string().url(),
  imageUrl: z.string().url().nullable(),
});

export function parseCharacterSearch(html: string): CharacterSearchResult[] {
  const results: CharacterSearchResult[] = [];
  for (const block of html.split('<tr>').slice(1)) {
    const idMatch = block.match(/character\/(\d+)\/([^"]*)"/i);
    if (!idMatch) continue;
    const malId = Number(idMatch[1]);
    const name = decodeHtml(block.match(/character\/\d+\/[^"]*">([^<]+)<\/a>/i)?.[1] ?? '');
    const imageUrl = imageFrom(block);
    const candidate = { malId, name, url: `https://myanimelist.net/character/${malId}/${idMatch[2]}`, imageUrl };
    const parsed = entrySchema.safeParse(candidate);
    if (parsed.success) results.push(parsed.data);
  }
  if (results.length === 0) throw new ParserError('empty_character_search_page');
  return results;
}
