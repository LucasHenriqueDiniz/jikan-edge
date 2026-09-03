import { z } from 'zod';
import type { TitleReview } from '../domain/title-review';
import { decodeHtml, numeric, originalImage, ParserError, richText } from './html';

const entrySchema = z.object({
  username: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  date: z.string().nullable(),
  tag: z.string().nullable(),
  score: z.number().nullable(),
  reviewText: z.string().nullable(),
});

// Same card markup as the global reviews list (reviews.parser.ts), except the per-title page
// never links back to the anime/manga being reviewed (that's implicit from the URL), so there's
// no malId/title to extract here — everything else (reviewer, date, tag, score, text) is shared.
function parseCard(chunk: string): TitleReview | null {
  const imageUrl = originalImage(chunk.match(/data-ga-click-type="review-\w+-reviewer-pic"[\s\S]{0,300}?data-src="([^"]+)"/i)?.[1] ?? null);
  const username = decodeHtml(chunk.match(/data-ga-click-type="review-\w+-reviewer">([^<]+)<\/a>/i)?.[1] ?? '') || null;
  const date = chunk.match(/class="update_at">([^<]+)<\/div>/i)?.[1] ?? null;
  const tag = decodeHtml(chunk.match(/class="tag [^"]*btn-label[^"]*"[^>]*>(?:<i[^>]*><\/i>)?([^<]+)<\/div>/i)?.[1] ?? '') || null;
  const score = numeric(chunk.match(/Rating:\s*<span class="num">(\d+)<\/span>/i)?.[1] ?? null);
  const textMarker = 'class="text">';
  const textStart = chunk.indexOf(textMarker);
  const textEnd = chunk.indexOf('<div class="rating', textStart);
  const reviewText = textStart === -1 ? null : richText(chunk.slice(textStart + textMarker.length, textEnd === -1 ? textStart + 6_000 : textEnd)) || null;
  const candidate = { username, imageUrl, date, tag, score, reviewText };
  const parsed = entrySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function parseTitleReviews(html: string): TitleReview[] {
  const entries = html.split('review-element js-review-element').slice(1).map(parseCard).filter((entry): entry is TitleReview => entry !== null);
  if (entries.length === 0) throw new ParserError('empty_title_reviews_page');
  return entries;
}
