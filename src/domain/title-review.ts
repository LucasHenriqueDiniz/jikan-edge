export interface TitleReview {
  username: string | null;
  imageUrl: string | null;
  date: string | null;
  tag: string | null;
  score: number | null;
  reviewText: string | null;
}

export const TITLE_REVIEWS_PARSER_VERSION = 'title-reviews-html-v2';
