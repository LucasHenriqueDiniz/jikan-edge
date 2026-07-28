import type { NamedRef } from '../domain/named-ref';

export function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number.parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function capture(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : null;
}

export function numeric(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

const MAL_BASE = 'https://myanimelist.net';

/**
 * Anchors in MAL's info sidebar carry the entity id in the href (`/anime/genre/1/Action`), so a
 * text-only extraction throws away the `mal_id` and `url` that Jikan clients filter on.
 * Anchors without a numeric segment are skipped rather than emitted with a fake id.
 */
export function anchorRefs(block: string): NamedRef[] {
  const refs: NamedRef[] = [];
  for (const match of block.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi)) {
    const href = match[1].trim();
    const malId = Number(href.match(/\/(\d+)(?:\/|$)/)?.[1]);
    if (!Number.isInteger(malId) || malId <= 0) continue;
    refs.push({ malId, name: decodeHtml(match[2]), url: href.startsWith('http') ? href : `${MAL_BASE}${href}` });
  }
  return refs;
}

export class ParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParserError';
  }
}
