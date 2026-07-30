import { z } from 'zod';
import type { NewsItem } from '../domain/news';
import { decodeHtml, imageFrom, ParserError } from './html';

const newsSchema = z.object({
  malId: z.number().int().positive(), title: z.string().min(1), url: z.string().url(),
  imageUrl: z.string().url().nullable(), excerpt: z.string().nullable(), date: z.string().nullable(), author: z.string().nullable(),
});

export function parseNews(html: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const block of html.split('class="picSurround fl-l mr8 ml3 mt4"').slice(1)) {
    const idMatch = block.match(/href="\/news\/(\d+)"/i);
    if (!idMatch) continue;
    const malId = Number(idMatch[1]);
    const imageUrl = imageFrom(block);
    const title = decodeHtml(block.match(/<strong>([^<]+)<\/strong>/i)?.[1] ?? '');
    const excerpt = decodeHtml(block.match(/<p>([\s\S]*?)<a href="\/news\/\d+">read more<\/a><\/p>/i)?.[1] ?? '') || null;
    const dateBlock = block.match(/class="lightLink spaceit">([\s\S]*?)<\/p>/i)?.[1] ?? '';
    const date = decodeHtml(dateBlock.split(' by ')[0] ?? '') || null;
    const author = decodeHtml(dateBlock.match(/href="\/profile\/[^"]*">([^<]+)<\/a>/i)?.[1] ?? '') || null;
    const candidate = { malId, title, url: `https://myanimelist.net/news/${malId}`, imageUrl, excerpt, date, author };
    const parsed = newsSchema.safeParse(candidate);
    if (parsed.success) items.push(parsed.data);
  }
  if (items.length === 0) throw new ParserError('empty_news_page');
  return items;
}
