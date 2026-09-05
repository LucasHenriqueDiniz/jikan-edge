import { z } from 'zod';
import type { MangaDetail } from '../domain/manga';
import {
  anchorRefs,
  backgroundSection,
  canonicalUrl,
  capture,
  COVER_IMAGE,
  dateRangeSchema,
  imageSetSchema,
  imageVariants,
  labelBlock,
  labelValue,
  malRefSchema,
  numeric,
  ParserError,
  parseDateRange,
  rankedValue,
  richCapture,
  taggedImage,
  titleSynonyms,
} from './html';
import { extractExternalLinks, extractRelations } from './relations-links';

const relationSchema = z.object({
  relation: z.string().min(1),
  malId: z.number().int().positive(),
  type: z.enum(['anime', 'manga']),
  title: z.string().min(1),
});
const externalLinkSchema = z.object({ name: z.string().min(1), url: z.string().url() });

const mangaDetailSchema = z.object({
  malId: z.number().int().positive(),
  url: z.string().url().nullable(),
  title: z.string().min(1),
  titleEnglish: z.string().nullable(),
  titleJapanese: z.string().nullable(),
  titleSynonyms: z.array(z.string()),
  imageUrl: z.string().url().nullable(),
  images: imageSetSchema,
  synopsis: z.string().nullable(),
  background: z.string().nullable(),
  type: z.string().nullable(),
  volumes: z.number().nullable(),
  chapters: z.number().nullable(),
  status: z.string().nullable(),
  publishing: z.boolean(),
  published: dateRangeSchema,
  authors: z.array(malRefSchema),
  serializations: z.array(malRefSchema),
  genres: z.array(malRefSchema),
  themes: z.array(malRefSchema),
  demographics: z.array(malRefSchema),
  score: z.number().nullable(),
  scoredBy: z.number().nullable(),
  rank: z.number().nullable(),
  popularity: z.number().nullable(),
  members: z.number().nullable(),
  favorites: z.number().nullable(),
  relations: z.array(relationSchema),
  externalLinks: z.array(externalLinkSchema),
  fetchedAt: z.string().datetime(),
});

export function parseMangaDetail(html: string, malId: number, fetchedAt = new Date().toISOString()): MangaDetail {
  const head = html.slice(0, 90_000);
  const title = capture(head, /<span class="h1-title">\s*<span itemprop="name">([^<]+)<\/span>/i);
  const imageUrl = taggedImage(head, COVER_IMAGE);
  const status = labelValue(head, 'Status');
  const detail: MangaDetail = {
    malId,
    url: canonicalUrl(head),
    title: title ?? '',
    titleEnglish: labelValue(head, 'English'),
    titleJapanese: labelValue(head, 'Japanese'),
    titleSynonyms: titleSynonyms(head),
    imageUrl,
    images: imageVariants(imageUrl, 'manga'),
    synopsis: richCapture(head, /<span itemprop="description">([\s\S]*?)<\/span>/i),
    background: backgroundSection(html),
    type: labelValue(head, 'Type'),
    volumes: numeric(labelValue(head, 'Volumes')),
    chapters: numeric(labelValue(head, 'Chapters')),
    status,
    publishing: status === 'Publishing',
    published: parseDateRange(labelValue(head, 'Published')),
    authors: anchorRefs(labelBlock(head, 'Authors', 'Author')),
    serializations: anchorRefs(labelBlock(head, 'Serialization')),
    genres: anchorRefs(labelBlock(head, 'Genres', 'Genre')),
    themes: anchorRefs(labelBlock(head, 'Themes', 'Theme')),
    demographics: anchorRefs(labelBlock(head, 'Demographics', 'Demographic')),
    score: numeric(capture(head, /<span itemprop="ratingValue"[^>]*>([\d.]+)<\/span>/i)),
    scoredBy: numeric(capture(head, /<span itemprop="ratingCount"[^>]*>([\d,]+)<\/span>/i)),
    rank: rankedValue(head, 'Ranked'),
    popularity: rankedValue(head, 'Popularity'),
    members: numeric(labelValue(head, 'Members')),
    favorites: numeric(labelValue(head, 'Favorites')),
    relations: extractRelations(html),
    externalLinks: extractExternalLinks(html),
    fetchedAt,
  };
  const validated = mangaDetailSchema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_manga_detail');
  return validated.data;
}
