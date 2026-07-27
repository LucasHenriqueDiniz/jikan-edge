import { z } from 'zod';
import type { Magazine } from '../domain/magazine';
import { decodeHtml, numeric, ParserError } from './html';

const magazineSchema = z.object({ malId: z.number().int().positive(), name: z.string().min(1), count: z.number().int().min(0), url: z.string().url() });

// The real magazine directory has 1000+ entries. Same network-dependent reduction risk as the
// genre sidebar (see docs/results/2026-07-26-genre-taxonomy-cloudflare-network-block.md) — reject
// an implausibly short result rather than silently cache an incomplete directory.
const MIN_EXPECTED_MAGAZINES = 500;

const MAGAZINE_PATTERN = /<a href="\/manga\/magazine\/(\d+)\/[^"]*" class="genre-name-link">([^(<]+)\((\d+)\)<\/a>/gi;

export function parseMagazines(html: string): Magazine[] {
  const magazines = new Map<number, Magazine>();
  for (const match of html.matchAll(MAGAZINE_PATTERN)) {
    const malId = Number(match[1]);
    const name = decodeHtml(match[2]);
    if (!magazines.has(malId)) magazines.set(malId, { malId, name, count: numeric(match[3]) ?? 0, url: `https://myanimelist.net/manga/magazine/${malId}/${encodeURIComponent(name.replace(/ /g, '_'))}` });
  }
  const list = [...magazines.values()].sort((a, b) => a.malId - b.malId);
  const validated = z.array(magazineSchema).safeParse(list);
  if (!validated.success || validated.data.length < MIN_EXPECTED_MAGAZINES) throw new ParserError('invalid_magazine_list');
  return validated.data;
}
