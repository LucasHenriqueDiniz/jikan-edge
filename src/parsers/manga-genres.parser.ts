import { z } from 'zod';
import type { Genre } from '../domain/anime';
import { decodeHtml, ParserError } from './html';

const genreSchema = z.object({ malId: z.number().int().positive(), name: z.string().min(1), url: z.string().url() });

const GENRE_PATTERN = /<span class="genre">\s*<a href="\/manga\/genre\/(\d+)\/[^"]*"[^>]*>([^<]+)<\/a>\s*<\/span>/gi;

// See the identical note in anime-genres.parser.ts: MAL has been observed serving a much shorter
// genre sidebar to requests from Cloudflare's network. Reject implausibly short results rather
// than silently caching an incomplete taxonomy as valid.
const MIN_EXPECTED_GENRES = 20;

export function parseMangaGenres(html: string): Genre[] {
  const genres = new Map<number, Genre>();
  for (const match of html.matchAll(GENRE_PATTERN)) {
    const malId = Number(match[1]);
    const name = decodeHtml(match[2]);
    if (!genres.has(malId)) genres.set(malId, { malId, name, url: `https://myanimelist.net/manga/genre/${malId}/${encodeURIComponent(name.replace(/ /g, '_'))}` });
  }
  const list = [...genres.values()].sort((a, b) => a.malId - b.malId);
  const validated = z.array(genreSchema).safeParse(list);
  if (!validated.success || validated.data.length < MIN_EXPECTED_GENRES) throw new ParserError('invalid_genre_list');
  return validated.data;
}
