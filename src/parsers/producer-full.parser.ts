import { z } from 'zod';
import type { ExternalLink } from '../domain/anime';
import type { ProducerFull } from '../domain/producer-full';
import { decodeHtml, ParserError } from './html';
import { parseProducerDetail } from './producer-detail.parser';

const extraSchema = z.object({
  about: z.string().nullable(),
  external: z.array(z.object({ name: z.string(), url: z.string().url() })),
});

function extractAbout(html: string): string | null {
  const idx = html.indexOf('Member Favorites');
  if (idx === -1) return null;
  const match = html.slice(idx).match(/<div class="spaceit_pad">\s*<span>([\s\S]*?)<\/span>\s*<\/div>/i);
  const text = match ? decodeHtml(match[1]) : '';
  return text || null;
}

function extractExternal(html: string): ExternalLink[] {
  const start = html.indexOf('Available At');
  if (start === -1) return [];
  const end = html.indexOf('content-right', start);
  const block = html.slice(start, end === -1 ? start + 4_000 : end);
  const links: ExternalLink[] = [];
  const seen = new Set<string>();
  for (const match of block.matchAll(/<a href="([^"]+)" target="_blank" rel="noreferrer">([^<]+)<\/a>/gi)) {
    const url = match[1].replace(/[\t\r\n]+/g, '');
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ name: decodeHtml(match[2]), url });
  }
  return links;
}

export function parseProducerFull(html: string, malId: number, fetchedAt = new Date().toISOString()): ProducerFull {
  const detail = parseProducerDetail(html, malId, fetchedAt);
  const extra = { about: extractAbout(html), external: extractExternal(html) };
  const validated = extraSchema.safeParse(extra);
  if (!validated.success) throw new ParserError('invalid_producer_full');
  return { ...detail, ...validated.data };
}
