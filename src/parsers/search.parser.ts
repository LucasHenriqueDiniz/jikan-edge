import { z } from 'zod';
import type { SearchEntry } from '../domain/search';
import { decodeHtml, numeric } from './html';

const entrySchema = z.object({
  malId: z.number().int().positive(),
  title: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  synopsis: z.string().nullable(),
  type: z.string().nullable(),
  episodes: z.number().nullable(),
  score: z.number().nullable(),
});

function parseCard(chunk: string): SearchEntry | null {
  // Each real result row contains two "sarea{id}" markers (the image link, and an empty
  // hover-preview div right before the title) — matching either is fine since both carry the
  // same id, but the row must be split on a boundary that keeps the image, title, and the
  // type/episodes/score cells together (see splitRows).
  const idMatch = chunk.match(/id="sarea(\d+)"/);
  if (!idMatch) return null;
  const malId = Number(idMatch[1]);
  const imageUrl = chunk.match(/data-src="([^"]+)"/i)?.[1] ?? null;
  const title = decodeHtml(chunk.match(/<strong>([^<]+)<\/strong>/i)?.[1] ?? '');
  const synopsisRaw = chunk.match(/class="pt4">([\s\S]*?)<a\s/i)?.[1] ?? null;
  const synopsis = synopsisRaw ? decodeHtml(synopsisRaw).replace(/\s*read more\.?$/i, '').replace(/\.{3}$/, '').trim() || null : null;
  const cells = [...chunk.matchAll(/<td class="borderClass ac bgColor\d"[^>]*>\s*([\s\S]*?)\s*<\/td>/gi)].map((match) => decodeHtml(match[1]));
  const candidate = {
    malId, title, imageUrl, synopsis,
    type: cells[0] || null,
    episodes: numeric(cells[1] ?? null),
    score: numeric(cells[2] ?? null),
  };
  const parsed = entrySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function splitRows(html: string): string[] {
  return html.split('<tr>').slice(1);
}

export function parseSearchResults(html: string): SearchEntry[] {
  return splitRows(html).map(parseCard).filter((entry): entry is SearchEntry => entry !== null);
}
