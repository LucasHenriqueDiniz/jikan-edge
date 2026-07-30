export interface ReviewEntry {
  malId: number;
  title: string;
  imageUrl: string | null;
  username: string | null;
  date: string | null;
  tag: string | null;
  score: number | null;
  reviewText: string | null;
}

export const REVIEW_PARSER_VERSION = 'review-html-v2';
