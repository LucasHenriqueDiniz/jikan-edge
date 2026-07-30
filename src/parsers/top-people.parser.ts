import { z } from 'zod';
import type { TopPersonEntry } from '../domain/top-person';
import { decodeHtml, imageFrom, numeric, ParserError } from './html';

const entrySchema = z.object({
  malId: z.number().int().positive(), name: z.string().min(1), nameKanji: z.string().nullable(), imageUrl: z.string().url().nullable(),
  birthday: z.string().nullable(), favorites: z.number().nullable(),
});

const ROW_PATTERN = /<tr class="ranking-list">([\s\S]*?)<\/tr>/gi;

export function parseTopPeople(html: string): TopPersonEntry[] {
  const entries: TopPersonEntry[] = [];
  for (const match of html.matchAll(ROW_PATTERN)) {
    const row = match[1];
    const malId = Number(row.match(/href="https:\/\/myanimelist\.net\/people\/(\d+)\//i)?.[1]);
    if (!malId) continue;
    const name = decodeHtml(row.match(/class="fs14 fw-b">([^<]+)<\/a>/i)?.[1] ?? '');
    const nameKanji = decodeHtml(row.match(/class="fs12 fn-grey6 text-ellipsis">\(([^)]+)\)<\/div>/i)?.[1] ?? '') || null;
    const imageUrl = imageFrom(row);
    const birthday = decodeHtml(row.match(/class="birthday">([^<]+)<\/td>/i)?.[1] ?? '') || null;
    const favorites = numeric(row.match(/class="favorites">\s*([\d,]+)\s*<\/td>/i)?.[1] ?? null);
    const parsed = entrySchema.safeParse({ malId, name, nameKanji, imageUrl, birthday, favorites });
    if (parsed.success) entries.push(parsed.data);
  }
  if (entries.length === 0) throw new ParserError('empty_top_people_page');
  return entries;
}
