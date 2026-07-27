export interface NewsItem {
  malId: number;
  title: string;
  url: string;
  imageUrl: string | null;
  excerpt: string | null;
  date: string | null;
  author: string | null;
}

export const NEWS_PARSER_VERSION = 'news-html-v1';
