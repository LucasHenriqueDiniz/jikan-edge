import { z } from 'zod';
import type { Genre } from '../domain/anime';
import { decodeHtml, ParserError } from './html';

const genreSchema = z.object({ malId: z.number().int().positive(), name: z.string().min(1), url: z.string().url() });

const GENRE_PATTERN = /<span class="genre">\s*<a href="\/anime\/genre\/(\d+)\/[^"]*"[^>]*>([^<]+)<\/a>\s*<\/span>/gi;

// The real anime genre taxonomy has 40+ entries. MAL has been observed serving a much shorter
// sidebar (~12-13 entries) specifically to requests originating from Cloudflare's network — the
// page still returns 200 with well-formed HTML, so this can't be caught by classifyHtml. Reject
// implausibly short results here instead of silently caching an incomplete taxonomy as valid.
const MIN_EXPECTED_GENRES = 20;

export function parseAnimeGenres(html: string): Genre[] {
  const genres = new Map<number, Genre>();
  for (const match of html.matchAll(GENRE_PATTERN)) {
    const malId = Number(match[1]);
    const name = decodeHtml(match[2]);
    if (!genres.has(malId)) genres.set(malId, { malId, name, url: `https://myanimelist.net/anime/genre/${malId}/${encodeURIComponent(name.replace(/ /g, '_'))}` });
  }
  const list = [...genres.values()].sort((a, b) => a.malId - b.malId);
  const validated = z.array(genreSchema).safeParse(list);
  if (!validated.success || validated.data.length < MIN_EXPECTED_GENRES) throw new ParserError('invalid_genre_list');
  return validated.data;
}
