import { z } from 'zod';
import type { TitleReview } from '../domain/title-review';
import { decodeHtml, numeric, originalImage, ParserError, richText } from './html';
import { reviewMarkers, reviewMarkersShape } from './review-markers';

export const entrySchema = z.object({
  username: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  date: z.string().nullable(),
  tag: z.string().nullable(),
  score: z.number().nullable(),
  reviewText: z.string().nullable(),
  ...reviewMarkersShape,
});

// Same card markup as the global reviews list (reviews.parser.ts), except the per-title page
// never links back to the anime/manga being reviewed (that's implicit from the URL), so there's
// no malId/title to extract here — everything else (reviewer, date, tag, score, text) is shared.
function parseCard(chunk: string): TitleReview | null {
  const imageUrl = originalImage(
    chunk.match(/data-ga-click-type="review-\w+-reviewer-pic"[\s\S]{0,300}?data-src="([^"]+)"/i)?.[1] ?? null,
  );
  const username = decodeHtml(chunk.match(/data-ga-click-type="review-\w+-reviewer">([^<]+)<\/a>/i)?.[1] ?? '') || null;
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
  const candidate = { username, imageUrl, date, tag, score, reviewText, ...reviewMarkers(chunk) };
  const parsed = entrySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

// The two ways MAL says a title's review page is legitimately empty: nothing was ever written, or
// the preliminary/spoiler toggles excluded everything there was (One Piece with preliminary off).
// Measured on 2026-10-11. Any other page without cards is still a broken document.
const NO_REVIEWS = /No reviews have been submitted for this title\.|No reviews found that match this filter criteria\./;

export function parseTitleReviews(html: string): TitleReview[] {
  const entries = html
    .split('review-element js-review-element')
    .slice(1)
    .map(parseCard)
    .filter((entry): entry is TitleReview => entry !== null);
  if (entries.length === 0 && !NO_REVIEWS.test(html)) throw new ParserError('empty_title_reviews_page');
  return entries;
}
