import { z } from 'zod';
import { MANGA_PARSER_VERSION, type MangaDetail } from '../domain/manga';
import { anchorRefs, capture, numeric, ParserError } from './html';
import { extractExternalLinks, extractRelations } from './relations-links';

const namedRefSchema = z.object({ malId: z.number().int().positive(), name: z.string().min(1), url: z.string().url() });
const relationSchema = z.object({ relation: z.string().min(1), malId: z.number().int().positive(), type: z.enum(['anime', 'manga']), title: z.string().min(1) });
const externalLinkSchema = z.object({ name: z.string().min(1), url: z.string().url() });

const mangaDetailSchema = z.object({
  malId: z.number().int().positive(),
  title: z.string().min(1),
  titleEnglish: z.string().nullable(),
  titleJapanese: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  synopsis: z.string().nullable(),
  type: z.string().nullable(),
  volumes: z.number().nullable(),
  chapters: z.number().nullable(),
  status: z.string().nullable(),
  published: z.string().nullable(),
  authors: z.array(namedRefSchema),
  serialization: z.string().nullable(),
  genres: z.array(namedRefSchema),
  themes: z.array(namedRefSchema),
  demographics: z.array(namedRefSchema),
  score: z.number().nullable(),
  rank: z.number().nullable(),
  popularity: z.number().nullable(),
  members: z.number().nullable(),
  favorites: z.number().nullable(),
  relations: z.array(relationSchema),
  externalLinks: z.array(externalLinkSchema),
  fetchedAt: z.string().datetime(),
  sourceVersion: z.string(),
});

function plainLabelValue(html: string, ...labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const value = capture(html, new RegExp(`${escaped}:<\\/span>([\\s\\S]*?)<\\/div>`, 'i'));
    if (value !== null) return value;
  }
  return null;
}

function rawLabelBlock(html: string, ...labels: string[]): string {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(new RegExp(`${escaped}:<\\/span>([\\s\\S]*?)<\\/div>`, 'i'));
    if (match) return match[1];
  }
  return '';
}

function rankedValue(html: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return numeric(capture(html, new RegExp(`${escaped}:<\\/span>\\s*#([\\d,]+)`, 'i')));
}

function extractImage(html: string): string | null {
  const tag = html.match(/<img[^>]*itemprop="image"[^>]*>/i)?.[0];
  if (!tag) return null;
  return tag.match(/\sdata-src="([^"]+)"/i)?.[1] ?? tag.match(/\ssrc="([^"]+)"/i)?.[1] ?? null;
}

export function parseMangaDetail(html: string, malId: number, fetchedAt = new Date().toISOString()): MangaDetail {
  const head = html.slice(0, 90_000);
  const title = capture(head, /<span class="h1-title">\s*<span itemprop="name">([^<]+)<\/span>/i);
  const detail: MangaDetail = {
    malId,
    title: title ?? '',
    titleEnglish: plainLabelValue(head, 'English'),
    titleJapanese: plainLabelValue(head, 'Japanese'),
    imageUrl: extractImage(head),
    synopsis: capture(head, /<span itemprop="description">([\s\S]*?)<\/span>/i),
    type: plainLabelValue(head, 'Type'),
    volumes: numeric(plainLabelValue(head, 'Volumes')),
    chapters: numeric(plainLabelValue(head, 'Chapters')),
    status: plainLabelValue(head, 'Status'),
    published: plainLabelValue(head, 'Published'),
    authors: anchorRefs(rawLabelBlock(head, 'Authors', 'Author')),
    serialization: plainLabelValue(head, 'Serialization'),
    genres: anchorRefs(rawLabelBlock(head, 'Genres', 'Genre')),
    themes: anchorRefs(rawLabelBlock(head, 'Themes', 'Theme')),
    demographics: anchorRefs(rawLabelBlock(head, 'Demographics', 'Demographic')),
    score: numeric(capture(head, /<span itemprop="ratingValue"[^>]*>([\d.]+)<\/span>/i)),
    rank: rankedValue(head, 'Ranked'),
    popularity: rankedValue(head, 'Popularity'),
    members: numeric(plainLabelValue(head, 'Members')),
    favorites: numeric(plainLabelValue(head, 'Favorites')),
    relations: extractRelations(html),
    externalLinks: extractExternalLinks(html),
    fetchedAt,
    sourceVersion: MANGA_PARSER_VERSION,
  };
  const validated = mangaDetailSchema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_manga_detail');
  return validated.data;
}
