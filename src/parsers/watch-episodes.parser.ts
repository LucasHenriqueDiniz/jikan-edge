import { z } from 'zod';
import type { WatchEpisodeEntry } from '../domain/watch';
import { decodeHtml, imageFrom, ParserError } from './html';

const entrySchema = z.object({
  animeId: z.number().int().positive(),
  animeTitle: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  episodes: z.array(z.string()),
});

function parseCard(chunk: string): WatchEpisodeEntry | null {
  const animeId = Number(chunk.match(/data-anime-id="(\d+)"/i)?.[1]);
  if (!animeId) return null;
  const imageUrl = imageFrom(chunk);
  const episodes = [...chunk.matchAll(/<a href="[^"]*\/episode\/\d+"[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => decodeHtml(match[1]));
  const titleMatch = chunk.match(/<a href="https:\/\/myanimelist\.net\/anime\/\d+\/[^"]*" class="mr4">([^<]+)<\/a>/i);
  const candidate = { animeId, animeTitle: titleMatch ? decodeHtml(titleMatch[1]) : '', imageUrl, episodes };
  const parsed = entrySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function parseWatchEpisodes(html: string): WatchEpisodeEntry[] {
  const entries = html.split('class="video-list episode').slice(1).map(parseCard).filter((entry): entry is WatchEpisodeEntry => entry !== null);
  if (entries.length === 0) throw new ParserError('empty_watch_episodes_page');
  return entries;
}
