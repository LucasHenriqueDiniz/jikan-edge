import { z } from 'zod';
import type { WatchPromoEntry } from '../domain/watch';
import { decodeHtml, ParserError } from './html';

const entrySchema = z.object({
  animeId: z.number().int().positive(),
  animeTitle: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  title: z.string(),
  videoUrl: z.string().url().nullable(),
});

function parseCard(chunk: string): WatchPromoEntry | null {
  const animeId = Number(chunk.match(/data-anime-id="(\d+)"/i)?.[1]);
  if (!animeId) return null;
  const videoUrl = chunk.slice(0, 300).match(/href="([^"]+)"/i)?.[1] ?? null;
  const imageUrl = chunk.match(/data-bg="([^"]+)"/i)?.[1] ?? null;
  const title = decodeHtml(chunk.match(/data-title="([^"]*)"/i)?.[1] ?? '');
  const titleMatch = chunk.match(/<a href="https:\/\/myanimelist\.net\/anime\/\d+\/[^"]*" class="mr4">([^<]+)<\/a>/i);
  const candidate = { animeId, animeTitle: titleMatch ? decodeHtml(titleMatch[1]) : '', imageUrl, title, videoUrl };
  const parsed = entrySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function parseWatchPromos(html: string): WatchPromoEntry[] {
  const entries = html
    .split('class="iframe js-fancybox-video')
    .slice(1)
    .map(parseCard)
    .filter((entry): entry is WatchPromoEntry => entry !== null);
  if (entries.length === 0) throw new ParserError('empty_watch_promos_page');
  return entries;
}
