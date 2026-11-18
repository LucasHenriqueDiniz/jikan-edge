export interface NewsItem {
  malId: number;
  title: string;
  url: string;
  imageUrl: string | null;
  excerpt: string | null;
  date: string | null;
  author: string | null;
}

// v3 (2026-11-18): an item without a picture is no longer merged into the one before it and lost.
export const NEWS_PARSER_VERSION = 'news-html-v3';
