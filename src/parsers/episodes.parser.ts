import { z } from 'zod';
import type { Episode } from '../domain/episode';
import { decodeHtml, numeric, ParserError } from './html';

export const episodeSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  titleJapanese: z.string().nullable(),
  url: z.string().url(),
  aired: z.string().nullable(),
  score: z.number().nullable(),
  forumReplies: z.number().nullable(),
  filler: z.boolean(),
  recap: z.boolean(),
});

// A Filler or Recap row carries its marker as a `<span>` *before* the title anchor:
// `<td class="episode-title fs12"><span class="fl-r di-ib pr4 icon-episode-type-bg">Filler</span><a href=…`.
// The title pattern used to require the anchor to open the cell, so every such row failed to match
// and was skipped without a trace — 11 of the 100 episodes on One Piece's first page.
const TITLE_CELL =
  /class="episode-title[^"]*">\s*(?:<span[^>]*icon-episode-type-bg[^>]*>\s*([^<]*?)\s*<\/span>\s*)?<a href="([^"]+)"[^>]*>([^<]+)<\/a>/i;

// `allowEmpty` is for pages past the first: MAL answers an offset beyond the last episode with the
// same page and no rows, which is the end of the list rather than a broken document. It covers only
// that: a page that *has* rows and parses none of them is still a broken document, and answering it
// with [] would hide the next markup change behind a 200 on every page but the first.
export function parseEpisodes(html: string, allowEmpty = false): Episode[] {
  const episodes: Episode[] = [];
  const rows = html.split('class="episode-list-data"').slice(1);
  for (const block of rows) {
    const number = numeric(block.match(/class="episode-number[^"]*"\s*data-raw="(\d+)"/i)?.[1] ?? null);
    const titleMatch = block.match(TITLE_CELL);
    if (!number || !titleMatch) continue;
    const jpMatch = block.match(/<span class="di-ib">[^(<]*\(([^)]+)\)<\/span>/i);
    const aired = block.match(/class="episode-aired[^"]*">([^<]+)<\/td>/i)?.[1] ?? null;
    const score = numeric(block.match(/class="episode-poll[^"]*"[^>]*data-raw="([\d.]+)"/i)?.[1] ?? null);
    const forumReplies = numeric(block.match(/class="episode-forum[^"]*"[^>]*data-raw="(\d+)"/i)?.[1] ?? null);
    const candidate = {
      number,
      title: decodeHtml(titleMatch[3]),
      titleJapanese: jpMatch ? decodeHtml(jpMatch[1]) : null,
      url: titleMatch[2],
      aired: aired ? decodeHtml(aired) : null,
      score,
      forumReplies,
      filler: titleMatch[1]?.toLowerCase() === 'filler',
      recap: titleMatch[1]?.toLowerCase() === 'recap',
    };
    const parsed = episodeSchema.safeParse(candidate);
    if (parsed.success) episodes.push(parsed.data);
  }
  if (episodes.length === 0 && (!allowEmpty || rows.length > 0)) throw new ParserError('empty_episodes_page');
  return episodes;
}
