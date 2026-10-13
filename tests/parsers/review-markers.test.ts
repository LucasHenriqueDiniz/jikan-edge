import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseReviews } from '../../src/parsers/reviews.parser';
import { parseTitleReviews } from '../../src/parsers/title-reviews.parser';

// Real cards fetched through Cloudflare's network on 2026-10-11:
// - One Piece's review page with spoilers requested — a Preliminary card and a Spoiler card;
// - the global anime feed — one card with a reactions payload and one with `data-reactions=''`.
const titleCards = parseTitleReviews(readFileSync('tests/fixtures/reviews/one-piece-title-reviews-real.html', 'utf8'));
const feedCards = parseReviews(readFileSync('tests/fixtures/reviews/anime-feed-reactions-real.html', 'utf8'));

describe('review markers', () => {
  it('reads the review id and permalink of every card', () => {
    for (const card of [...titleCards, ...feedCards]) {
      expect(card.reviewId).toBeGreaterThan(0);
      expect(card.url).toBe(`https://myanimelist.net/reviews.php?id=${card.reviewId}`);
    }
  });

  // `<div class="tag preliminary">Preliminary <span> (344/? eps) </span></div>` — the only place MAL
  // prints how far the reviewer had got. The second card reads `(Unknown/? eps)`: MAL does not know,
  // so neither does the payload.
  it('flags a preliminary review and reads how far the reviewer had watched', () => {
    expect(titleCards.map((card) => card.isPreliminary)).toEqual([true, true]);
    expect(titleCards.map((card) => card.episodesWatched)).toEqual([344, null]);
    expect(titleCards.map((card) => card.chaptersRead)).toEqual([null, null]);
  });

  it('flags a spoiler review', () => {
    expect(titleCards.map((card) => card.isSpoiler)).toEqual([false, true]);
  });

  // count[i] belongs to the button whose data-val is i + 1, and `num` is the total.
  it('maps the reactions payload onto the seven buttons', () => {
    const withReactions = feedCards[0];
    expect(withReactions.reactions).not.toBeNull();
    const { overall, ...buttons } = withReactions.reactions ?? { overall: 0 };
    expect(Object.keys(buttons)).toEqual([
      'nice',
      'loveIt',
      'funny',
      'confusing',
      'informative',
      'wellWritten',
      'creative',
    ]);
    expect(overall).toBeGreaterThan(0);
  });

  // `data-reactions=''` means the page printed none, not that every count is zero.
  it('is null where the page carries no reactions payload', () => {
    expect(feedCards[1].reactions).toBeNull();
  });
});

describe('a title with no reviews', () => {
  const page = (notice: string) =>
    `<html><body><h2 class="h2_overwrite">Reviews</h2><div>${notice}</div></body></html>`;

  // The two notices MAL prints, measured on 2026-10-11: a title nobody reviewed (47571), and One
  // Piece with `preliminary=off`, which excludes every review it has.
  it('is an empty list when MAL says so', () => {
    expect(parseTitleReviews(page('No reviews have been submitted for this title.'))).toEqual([]);
    expect(parseTitleReviews(page('No reviews found that match this filter criteria.'))).toEqual([]);
  });

  it('is still an error on a page without cards that says nothing', () => {
    expect(() => parseTitleReviews(page(''))).toThrow('empty_title_reviews_page');
  });
});
