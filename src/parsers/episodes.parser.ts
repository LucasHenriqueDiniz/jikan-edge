import { z } from 'zod';
import type { Episode } from '../domain/episode';
import { decodeHtml, numeric, ParserError } from './html';

const episodeSchema = z.object({
  number: z.number().int().positive(), title: z.string().min(1), titleJapanese: z.string().nullable(),
  url: z.string().url(), aired: z.string().nullable(), score: z.number().nullable(), forumReplies: z.number().nullable(),
});

export function parseEpisodes(html: string): Episode[] {
  const episodes: Episode[] = [];
  for (const block of html.split('class="episode-list-data"').slice(1)) {
    const number = numeric(block.match(/class="episode-number[^"]*"\s*data-raw="(\d+)"/i)?.[1] ?? null);
    const titleMatch = block.match(/class="episode-title[^"]*">\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
    if (!number || !titleMatch) continue;
    const jpMatch = block.match(/<span class="di-ib">[^(<]*\(([^)]+)\)<\/span>/i);
    const aired = block.match(/class="episode-aired[^"]*">([^<]+)<\/td>/i)?.[1] ?? null;
    const score = numeric(block.match(/class="episode-poll[^"]*"[^>]*data-raw="([\d.]+)"/i)?.[1] ?? null);
    const forumReplies = numeric(block.match(/class="episode-forum[^"]*"[^>]*data-raw="(\d+)"/i)?.[1] ?? null);
    const candidate = {
      number, title: decodeHtml(titleMatch[2]), titleJapanese: jpMatch ? decodeHtml(jpMatch[1]) : null,
      url: titleMatch[1], aired: aired ? decodeHtml(aired) : null, score, forumReplies,
    };
    const parsed = episodeSchema.safeParse(candidate);
    if (parsed.success) episodes.push(parsed.data);
  }
  if (episodes.length === 0) throw new ParserError('empty_episodes_page');
  return episodes;
}
