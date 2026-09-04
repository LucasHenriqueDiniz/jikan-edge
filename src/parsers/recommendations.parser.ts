import { z } from 'zod';
import type { RecommendationEntry } from '../domain/recommendation';
import { decodeHtml, imageFrom, ParserError } from './html';

const entrySchema = z.object({
  malId: z.number().int().positive(),
  title: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  recommendedMalId: z.number().int().positive(),
  recommendedTitle: z.string().min(1),
  recommendedImageUrl: z.string().url().nullable(),
  content: z.string().nullable(),
  username: z.string().nullable(),
});

function extractSide(chunk: string, side: 1 | 2): { malId: number; title: string; imageUrl: string | null } | null {
  const idMatch = chunk.match(new RegExp(`id="#raArea${side}_(\\d+)"`, 'i'));
  if (!idMatch || idMatch.index === undefined) return null;
  const malId = Number(idMatch[1]);
  const window = chunk.slice(idMatch.index, idMatch.index + 1_500);
  const imageUrl = imageFrom(window);
  const title = decodeHtml(window.match(/<strong>([^<]+)<\/strong>/i)?.[1] ?? '');
  return { malId, title, imageUrl };
}

function parseCard(chunk: string): RecommendationEntry | null {
  const first = extractSide(chunk, 1);
  const second = extractSide(chunk, 2);
  if (!first || !second) return null;
  const content = decodeHtml(chunk.match(/recommendations-user-recs-text[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '') || null;
  const username = chunk.match(/rec by <a href="\/profile\/[^"]*">([^<]+)<\/a>/i)?.[1] ?? null;
  const candidate = {
    malId: first.malId,
    title: first.title,
    imageUrl: first.imageUrl,
    recommendedMalId: second.malId,
    recommendedTitle: second.title,
    recommendedImageUrl: second.imageUrl,
    content,
    username: username ? decodeHtml(username) : null,
  };
  const parsed = entrySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function parseRecommendations(html: string, allowEmpty = false): RecommendationEntry[] {
  const entries = html
    .split('class="spaceit borderClass"')
    .slice(1)
    .map(parseCard)
    .filter((entry): entry is RecommendationEntry => entry !== null);
  if (entries.length === 0 && !allowEmpty) throw new ParserError('empty_recommendations_page');
  return entries;
}
