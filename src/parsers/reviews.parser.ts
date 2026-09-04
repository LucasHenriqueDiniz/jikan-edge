import { z } from 'zod';
import type { ReviewEntry } from '../domain/review';
import { decodeHtml, numeric, originalImage, ParserError, richText } from './html';

const entrySchema = z.object({
  malId: z.number().int().positive(),
  title: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  username: z.string().nullable(),
  date: z.string().nullable(),
  tag: z.string().nullable(),
  score: z.number().nullable(),
  reviewText: z.string().nullable(),
});

function parseCard(chunk: string): ReviewEntry | null {
  const idMatch = chunk.match(/href="https:\/\/myanimelist\.net\/(?:anime|manga)\/(\d+)\//i);
  if (!idMatch) return null;
  const malId = Number(idMatch[1]);
  const title = decodeHtml(chunk.match(/class="title ga-click"[^>]*>([^<]+)<\/a>/i)?.[1] ?? '');
  const imageUrl = originalImage(
    chunk.match(/data-ga-click-type="review-\w+-title-pic"[\s\S]{0,300}?data-src="([^"]+)"/i)?.[1] ?? null,
  );
  const username = chunk.match(/data-ga-click-type="review-\w+-reviewer">([^<]+)<\/a>/i)?.[1] ?? null;
  const date = chunk.match(/class="update_at">([^<]+)<\/div>/i)?.[1] ?? null;
  const tag =
    decodeHtml(chunk.match(/class="tag [^"]*btn-label[^"]*"[^>]*>(?:<i[^>]*><\/i>)?([^<]+)<\/div>/i)?.[1] ?? '') ||
    null;
  const score = numeric(chunk.match(/Rating:\s*<span class="num">(\d+)<\/span>/i)?.[1] ?? null);
  const textMarker = 'class="text">';
  const textStart = chunk.indexOf(textMarker);
  const textEnd = chunk.indexOf('<div class="rating', textStart);
  const reviewText =
    textStart === -1
      ? null
      : richText(chunk.slice(textStart + textMarker.length, textEnd === -1 ? textStart + 6_000 : textEnd)) || null;
  const candidate = { malId, title, imageUrl, username, date, tag, score, reviewText };
  const parsed = entrySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function parseReviews(html: string, allowEmpty = false): ReviewEntry[] {
  const entries = html
    .split('review-element js-review-element')
    .slice(1)
    .map(parseCard)
    .filter((entry): entry is ReviewEntry => entry !== null);
  if (entries.length === 0 && !allowEmpty) throw new ParserError('empty_reviews_page');
  return entries;
}
