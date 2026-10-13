import type { ReviewMarkers } from './review';

export interface TitleReview extends ReviewMarkers {
  username: string | null;
  imageUrl: string | null;
  date: string | null;
  tag: string | null;
  score: number | null;
  reviewText: string | null;
}

// v3: review id, url, the preliminary/spoiler flags and the reactions; and a title with no reviews
// is an empty list instead of a 502.
export const TITLE_REVIEWS_PARSER_VERSION = 'title-reviews-html-v3';
