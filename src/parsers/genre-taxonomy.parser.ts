import { z } from 'zod';
import { GENRE_KINDS, type GenreKind, type GenreTaxonomyEntry } from '../domain/genre';
import { decodeHtml, ParserError } from './html';

const entrySchema = z.object({
  malId: z.number().int().positive(),
  name: z.string().min(1),
  url: z.string().url(),
  count: z.number().int().nonnegative(),
  type: z.enum(GENRE_KINDS),
});

// Source is the "Content Filter" block of the search page (`anime.php?cat=genre`), not the genre
// browse page sidebar (`/anime/genre/1/Action`). MAL serves that sidebar truncated to ~12 entries
// for requests coming from Cloudflare's network — see
// docs/results/2026-07-26-genre-taxonomy-cloudflare-network-block.md. The search page carries the
// full taxonomy split into the four categories Jikan exposes, plus the entry count per genre.
const HEADING_PATTERN = /<div class="[^"]*category-type"[^>]*>([^<]+)<\/div>/gi;
const ENTRY_PATTERN = /<input[^>]+name="genre\[\]"[^>]+value="(\d+)"[^>]*>\s*<p>([^<]+)<\/p>/gi;
// Names can carry their own parentheses ("Idols (Female) (417)"), so the count is the last group.
const NAME_WITH_COUNT = /^(.+?)\s*\(([\d,]+)\)$/;

const HEADINGS: Record<string, GenreKind> = {
  genres: 'genres',
  'explicit genres': 'explicit_genres',
  themes: 'themes',
  demographics: 'demographics',
};

// Real taxonomy is 78 (anime) / 79 (manga) entries across all four categories. Anything far below
// that, or missing a whole category, means a reduced document: refuse it instead of caching a
// partial taxonomy as if it were complete.
const MIN_EXPECTED_ENTRIES = 40;

export function parseGenreTaxonomy(html: string, type: 'anime' | 'manga'): GenreTaxonomyEntry[] {
  const start = html.indexOf('category-wrapper');
  if (start === -1) throw new ParserError('genre_taxonomy_not_found');
  const end = html.indexOf('</form>', start);
  const block = end === -1 ? html.slice(start) : html.slice(start, end);

  const headings = [...block.matchAll(HEADING_PATTERN)];
  const entries = new Map<number, GenreTaxonomyEntry>();
  for (const [index, heading] of headings.entries()) {
    const kind = HEADINGS[decodeHtml(heading[1]).toLowerCase()];
    if (!kind) continue;
    const from = (heading.index ?? 0) + heading[0].length;
    const section = block.slice(from, headings[index + 1]?.index ?? block.length);
    for (const match of section.matchAll(ENTRY_PATTERN)) {
      const malId = Number(match[1]);
      const label = decodeHtml(match[2]);
      const parts = label.match(NAME_WITH_COUNT);
      if (!parts) continue;
      const name = parts[1];
      if (entries.has(malId)) continue;
      entries.set(malId, {
        malId,
        name,
        url: `https://myanimelist.net/${type}/genre/${malId}/${encodeURIComponent(name.replace(/ /g, '_'))}`,
        count: Number(parts[2].replace(/,/g, '')),
        type: kind,
      });
    }
  }

  const list = [...entries.values()];
  const validated = z.array(entrySchema).safeParse(list);
  if (!validated.success) throw new ParserError('invalid_genre_list');
  const kinds = new Set(validated.data.map((entry) => entry.type));
  if (validated.data.length < MIN_EXPECTED_ENTRIES || kinds.size < GENRE_KINDS.length)
    throw new ParserError('incomplete_genre_taxonomy');
  return validated.data;
}
