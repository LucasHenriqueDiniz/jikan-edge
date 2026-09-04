import { z } from 'zod';
import type { AnimeListEntry } from '../domain/anime';
import { decodeHtml, imageFrom, numeric, ParserError } from './html';

const entrySchema = z.object({
  malId: z.number().int().positive(),
  title: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  score: z.number().nullable(),
  type: z.string().nullable(),
  episodes: z.number().nullable(),
  startDate: z.string().nullable(),
  members: z.number().nullable(),
});

const ROW_PATTERN = /<tr class="ranking-list">([\s\S]*?)<\/tr>/gi;

function rowImage(row: string): { title: string | null; imageUrl: string | null } {
  const tag = row.match(/<img[^>]*alt="Anime: ([^"]+)"[^>]*>/i);
  if (!tag) return { title: null, imageUrl: null };
  const imageUrl = imageFrom(tag[0]);
  return { title: decodeHtml(tag[1]), imageUrl };
}

function rowInformation(row: string): {
  type: string | null;
  episodes: number | null;
  startDate: string | null;
  members: number | null;
} {
  const match = row.match(/<div class="information[^"]*">([\s\S]*?)<\/div>/i);
  if (!match) return { type: null, episodes: null, startDate: null, members: null };
  const segments = match[1].split(/<br\s*\/?>/i).map((segment) => decodeHtml(segment));
  const [typeEpisodes, startDate, membersText] = segments;
  return {
    type: typeEpisodes?.match(/^(\S+)/)?.[1] ?? null,
    episodes: typeEpisodes?.match(/\((\d+)/) ? Number(typeEpisodes.match(/\((\d+)/)![1]) : null,
    startDate: startDate || null,
    members: numeric(membersText?.match(/([\d,]+)/)?.[1] ?? null),
  };
}

export function parseTopAnime(html: string): AnimeListEntry[] {
  const entries: AnimeListEntry[] = [];
  for (const match of html.matchAll(ROW_PATTERN)) {
    const row = match[1];
    const malId = Number(row.match(/href="https:\/\/myanimelist\.net\/anime\/(\d+)\//i)?.[1]);
    if (!malId) continue;
    const { title, imageUrl } = rowImage(row);
    const score = numeric(row.match(/class="text on score-label[^"]*">([\d.]+)<\/span>/i)?.[1] ?? null);
    const candidate = { malId, title: title ?? '', imageUrl, score, ...rowInformation(row) };
    const parsed = entrySchema.safeParse(candidate);
    if (parsed.success) entries.push(parsed.data);
  }
  if (entries.length === 0) throw new ParserError('empty_top_anime_page');
  return entries;
}
