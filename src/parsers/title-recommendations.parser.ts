import { z } from 'zod';
import type { TitleRecommendation } from '../domain/title-recommendation';
import { decodeHtml, imageFrom, ParserError } from './html';

export const entrySchema = z.object({
  malId: z.number().int().positive(),
  title: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  votes: z.number().int().positive(),
});

// Unlike the global "recent recommendations" feed (recommendations.parser.ts), the per-title
// page fixes one side of the pair to the title itself, so each card only shows the OTHER
// (recommended) work. "Read recommendations by N more users" only appears when more than one
// user recommended the same pairing — its absence means exactly 1 vote, not 0.
function parseCard(chunk: string): TitleRecommendation | null {
  const idMatch = chunk.match(/^(\d+)\//);
  if (!idMatch) return null;
  const malId = Number(idMatch[1]);
  const title = decodeHtml(chunk.match(/<strong>([^<]+)<\/strong>/i)?.[1] ?? '');
  const imageUrl = imageFrom(chunk);
  const moreVotes = chunk.match(/Read recommendations by <strong>(\d+)<\/strong> more users/i)?.[1];
  const votes = moreVotes ? Number(moreVotes) + 1 : 1;
  const parsed = entrySchema.safeParse({ malId, title, imageUrl, votes });
  return parsed.success ? parsed.data : null;
}

// The same notice on anime and manga (measured 2026-11-05 on anime 6891 and manga 175006). Only a
// page with no cards and this notice is an empty list; cards that no longer parse are a broken page.
const NO_RECOMMENDATIONS = /No recommendations have been made for this title\./;

export function parseTitleRecommendations(html: string, type: 'anime' | 'manga'): TitleRecommendation[] {
  const marker = `class="picSurround"><a href="https://myanimelist.net/${type}/`;
  const cards = html.split(marker).slice(1);
  const entries = cards.map(parseCard).filter((entry): entry is TitleRecommendation => entry !== null);
  const emptyIsValid = cards.length === 0 && NO_RECOMMENDATIONS.test(html);
  if (entries.length === 0 && !emptyIsValid) throw new ParserError('empty_title_recommendations_page');
  return entries;
}
