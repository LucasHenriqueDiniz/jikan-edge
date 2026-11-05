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

// MAL's own notice for a title nobody has added episodes to. It is on page 1 of a show with no episode
// data — Pakkororin lists `(0/1,512)` — and on a page past the last episode alike. Page 1 used to
// demand rows, so every such title answered 502 and, never cached, refetched MAL on each retry: 22k
// of the 54k 502s measured on 2026-11-05 came from 849 titles in this state.
const NO_EPISODES = /No episode information has been added to this title\./;

// `allowEmpty` is for pages past the first: MAL answers an offset beyond the last episode with the
// same page and no rows, which is the end of the list rather than a broken document. On page 1 an
// empty list needs MAL's notice above. Either way only a page with *no* rows can be empty: one that
// has rows and parses none of them is a broken document, and answering it with [] would hide the
// next markup change behind a 200.
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
  const emptyIsValid = rows.length === 0 && (allowEmpty || NO_EPISODES.test(html));
  if (episodes.length === 0 && !emptyIsValid) throw new ParserError('empty_episodes_page');
  return episodes;
}
