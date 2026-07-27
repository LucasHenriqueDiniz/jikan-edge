import { z } from 'zod';
import type { TitleRecommendation } from '../domain/title-recommendation';
import { decodeHtml, ParserError } from './html';

const entrySchema = z.object({
  malId: z.number().int().positive(), title: z.string().min(1), imageUrl: z.string().url().nullable(), votes: z.number().int().positive(),
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
  const imageUrl = chunk.match(/data-src="([^"]+)"/i)?.[1] ?? null;
  const moreVotes = chunk.match(/Read recommendations by <strong>(\d+)<\/strong> more users/i)?.[1];
  const votes = moreVotes ? Number(moreVotes) + 1 : 1;
  const parsed = entrySchema.safeParse({ malId, title, imageUrl, votes });
  return parsed.success ? parsed.data : null;
}

export function parseTitleRecommendations(html: string, type: 'anime' | 'manga'): TitleRecommendation[] {
  const marker = `class="picSurround"><a href="https://myanimelist.net/${type}/`;
  const entries = html.split(marker).slice(1).map(parseCard).filter((entry): entry is TitleRecommendation => entry !== null);
  if (entries.length === 0) throw new ParserError('empty_title_recommendations_page');
  return entries;
}
