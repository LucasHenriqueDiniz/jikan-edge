import { z } from 'zod';
import type { TopCharacterEntry, TopCharacterWorkRef } from '../domain/top-character';
import { decodeHtml, imageFrom, numeric, ParserError } from './html';

const workRefSchema = z.object({ malId: z.number().int().positive(), title: z.string().min(1) });
const entrySchema = z.object({
  malId: z.number().int().positive(),
  name: z.string().min(1),
  nameKanji: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  animeography: z.array(workRefSchema),
  mangaography: z.array(workRefSchema),
  favorites: z.number().nullable(),
});

const ROW_PATTERN = /<tr class="ranking-list">([\s\S]*?)<\/tr>/gi;

function extractWorkRefs(cell: string, type: 'anime' | 'manga'): TopCharacterWorkRef[] {
  const pattern = new RegExp(`${type}/(\\d+)/[^"]*">([^<]+)<\\/a>`, 'gi');
  return [...cell.matchAll(pattern)].map((match) => ({ malId: Number(match[1]), title: decodeHtml(match[2]) }));
}

export function parseTopCharacters(html: string): TopCharacterEntry[] {
  const entries: TopCharacterEntry[] = [];
  for (const match of html.matchAll(ROW_PATTERN)) {
    const row = match[1];
    const malId = Number(row.match(/href="https:\/\/myanimelist\.net\/character\/(\d+)\//i)?.[1]);
    if (!malId) continue;
    const name = decodeHtml(row.match(/class="fs14 fw-b">([^<]+)<\/a>/i)?.[1] ?? '');
    const nameKanji =
      decodeHtml(row.match(/class="fs12 fn-grey6 text-ellipsis">\(([^)]+)\)<\/div>/i)?.[1] ?? '') || null;
    const imageUrl = imageFrom(row);
    const animeographyCell = row.match(/class="animeography">([\s\S]*?)<\/td>/i)?.[1] ?? '';
    const mangaographyCell = row.match(/class="mangaography">([\s\S]*?)<\/td>/i)?.[1] ?? '';
    const favorites = numeric(row.match(/class="favorites">\s*([\d,]+)\s*<\/td>/i)?.[1] ?? null);
    const parsed = entrySchema.safeParse({
      malId,
      name,
      nameKanji,
      imageUrl,
      animeography: extractWorkRefs(animeographyCell, 'anime'),
      mangaography: extractWorkRefs(mangaographyCell, 'manga'),
      favorites,
    });
    if (parsed.success) entries.push(parsed.data);
  }
  if (entries.length === 0) throw new ParserError('empty_top_characters_page');
  return entries;
}
