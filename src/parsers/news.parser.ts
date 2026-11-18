import { z } from 'zod';
import type { NewsItem } from '../domain/news';
import { decodeHtml, imageFrom, ParserError } from './html';

export const newsSchema = z.object({
  malId: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().url(),
  imageUrl: z.string().url().nullable(),
  excerpt: z.string().nullable(),
  date: z.string().nullable(),
  author: z.string().nullable(),
});

// The same heading as NEWS_PAGE_MARKERS: the list starts right after it, on every news page.
const NEWS_HEADING = '<h2 class="mb8">News</h2>';
// MAL separates the items with this rule, and nothing after the heading uses it for anything else.
const ITEM_SEPARATOR = '<div class="borderClass"></div>';
// Every item has its title in this paragraph; the picture before it is optional.
const ITEM_TITLE = /<p class="spaceit"><a href="\/news\/(\d+)">/i;

/**
 * The news list of a title or person — empty when MAL has none.
 *
 * MAL's empty news page says nothing: the heading, then the end of the page, with no "no news"
 * notice to recognise (measured 2026-11-18). So the heading is the evidence that this is the news
 * page, and an empty list after it is an empty list. What stays an error is a page that lists news
 * and yields none of it: cached as empty for the whole TTL, a markup change would hide every item.
 *
 * Items are cut at MAL's separator, not at the picture block: the first version split on
 * `picSurround`, and an item without a picture — manga 4632 has one in thirteen — was silently
 * merged into the item before it and lost.
 */
export function parseNews(html: string): NewsItem[] {
  const start = html.indexOf(NEWS_HEADING);
  if (start < 0) throw new ParserError('news_heading_missing');
  const items: NewsItem[] = [];
  let listed = 0;
  for (const block of html.slice(start + NEWS_HEADING.length).split(ITEM_SEPARATOR)) {
    const idMatch = ITEM_TITLE.exec(block);
    if (!idMatch) continue;
    listed += 1;
    const malId = Number(idMatch[1]);
    const imageUrl = imageFrom(block);
    const title = decodeHtml(block.match(/<strong>([^<]+)<\/strong>/i)?.[1] ?? '');
    const excerpt =
      decodeHtml(block.match(/<p>([\s\S]*?)<a href="\/news\/\d+">read more<\/a><\/p>/i)?.[1] ?? '') || null;
    const dateBlock = block.match(/class="lightLink spaceit">([\s\S]*?)<\/p>/i)?.[1] ?? '';
    const date = decodeHtml(dateBlock.split(' by ')[0] ?? '') || null;
    const author = decodeHtml(dateBlock.match(/href="\/profile\/[^"]*">([^<]+)<\/a>/i)?.[1] ?? '') || null;
    const candidate = { malId, title, url: `https://myanimelist.net/news/${malId}`, imageUrl, excerpt, date, author };
    const parsed = newsSchema.safeParse(candidate);
    if (parsed.success) items.push(parsed.data);
  }
  if (listed > 0 && items.length === 0) throw new ParserError('news_items_unreadable');
  return items;
}
