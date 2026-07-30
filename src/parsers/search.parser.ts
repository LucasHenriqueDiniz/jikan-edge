import { z } from 'zod';
import type { AnimeSearchEntry, MangaSearchEntry } from '../domain/search';
import { decodeHtml, imageFrom, numeric } from './html';

const baseShape = {
  malId: z.number().int().positive(),
  url: z.string().url(),
  title: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  synopsis: z.string().nullable(),
  type: z.string().nullable(),
  score: z.number().nullable(),
};

const animeSchema = z.object({ ...baseShape, episodes: z.number().nullable() });
const mangaSchema = z.object({ ...baseShape, volumes: z.number().nullable() });

// The results table is identical markup for both media, and so are the three centred cells: type,
// a count, and the score. Only the count differs — episodes for anime, **volumes** for manga.
// Verified against the detail pages rather than assumed from the anime layout: Fullmetal Alchemist
// shows `27` in manga search, and its detail page reads 27 volumes / 116 chapters. Sharing one
// shape between the two searches published every completed manga's volume count as `episodes`.
function parseCard<T>(chunk: string, media: 'anime' | 'manga', schema: z.ZodType<T>): T | null {
  // Each real result row contains two "sarea{id}" markers (the image link, and an empty
  // hover-preview div right before the title) — matching either is fine since both carry the
  // same id, but the row must be split on a boundary that keeps the image, title, and the
  // type/count/score cells together (see splitRows).
  const idMatch = chunk.match(/id="sarea(\d+)"/);
  if (!idMatch) return null;
  const malId = Number(idMatch[1]);
  const href = chunk.match(new RegExp(`href="(https://myanimelist\\.net/${media}/${malId}/[^"]*)"`, 'i'))?.[1];
  const title = decodeHtml(chunk.match(/<strong>([^<]+)<\/strong>/i)?.[1] ?? '');
  const synopsisRaw = chunk.match(/class="pt4">([\s\S]*?)<a\s/i)?.[1] ?? null;
  const synopsis = synopsisRaw ? decodeHtml(synopsisRaw).replace(/\s*read more\.?$/i, '').replace(/\.{3}$/, '').trim() || null : null;
  const cells = [...chunk.matchAll(/<td class="borderClass ac bgColor\d"[^>]*>\s*([\s\S]*?)\s*<\/td>/gi)].map((match) => decodeHtml(match[1]));
  const count = numeric(cells[1] ?? null);
  const candidate = {
    malId,
    // The row already links the entry with its slug; falling back to the slugless form keeps a
    // usable link when MAL changes the anchor rather than dropping the field.
    url: href ?? `https://myanimelist.net/${media}/${malId}`,
    title,
    imageUrl: imageFrom(chunk),
    synopsis,
    type: cells[0] || null,
    ...(media === 'anime' ? { episodes: count } : { volumes: count }),
    score: numeric(cells[2] ?? null),
  };
  const parsed = schema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function splitRows(html: string): string[] {
  return html.split('<tr>').slice(1);
}

export function parseAnimeSearchResults(html: string): AnimeSearchEntry[] {
  return splitRows(html)
    .map((chunk) => parseCard(chunk, 'anime', animeSchema))
    .filter((entry): entry is AnimeSearchEntry => entry !== null);
}

export function parseMangaSearchResults(html: string): MangaSearchEntry[] {
  return splitRows(html)
    .map((chunk) => parseCard(chunk, 'manga', mangaSchema))
    .filter((entry): entry is MangaSearchEntry => entry !== null);
}
