import { z } from 'zod';
import type { AnimeDetail } from '../domain/anime';
import { capture, decodeHtml, numeric, ParserError } from './html';
import { extractExternalLinks, extractRelations, extractStreaming } from './relations-links';

const relationSchema = z.object({ relation: z.string().min(1), malId: z.number().int().positive(), type: z.enum(['anime', 'manga']), title: z.string().min(1) });
const externalLinkSchema = z.object({ name: z.string().min(1), url: z.string().url() });
const streamingSchema = z.object({ name: z.string().min(1), url: z.string().url(), available: z.boolean() });

const animeDetailSchema = z.object({
  malId: z.number().int().positive(),
  title: z.string().min(1),
  titleEnglish: z.string().nullable(),
  titleJapanese: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  synopsis: z.string().nullable(),
  type: z.string().nullable(),
  episodes: z.number().nullable(),
  status: z.string().nullable(),
  aired: z.string().nullable(),
  studios: z.array(z.string()),
  genres: z.array(z.string()),
  themes: z.array(z.string()),
  duration: z.string().nullable(),
  rating: z.string().nullable(),
  score: z.number().nullable(),
  rank: z.number().nullable(),
  popularity: z.number().nullable(),
  members: z.number().nullable(),
  favorites: z.number().nullable(),
  source: z.string().nullable(),
  relations: z.array(relationSchema),
  externalLinks: z.array(externalLinkSchema),
  streaming: z.array(streamingSchema),
  fetchedAt: z.string().datetime(),
});

function plainLabelValue(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return capture(html, new RegExp(`${escaped}:<\\/span>([\\s\\S]*?)<\\/div>`, 'i'));
}

function rawLabelBlock(html: string, ...labels: string[]): string {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(new RegExp(`${escaped}:<\\/span>([\\s\\S]*?)<\\/div>`, 'i'));
    if (match) return match[1];
  }
  return '';
}

function anchorTexts(block: string): string[] {
  return [...block.matchAll(/<a[^>]*>([^<]+)<\/a>/gi)].map((match) => decodeHtml(match[1]));
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

export function parseAnimeDetail(html: string, malId: number, fetchedAt = new Date().toISOString()): AnimeDetail {
  const head = html.slice(0, 90_000);
  const title = capture(head, /<h1[^>]*class="title-name[^"]*"[^>]*>\s*<strong>([^<]+)<\/strong>/i);
  const detail: AnimeDetail = {
    malId,
    title: title ?? '',
    titleEnglish: plainLabelValue(head, 'English'),
    titleJapanese: plainLabelValue(head, 'Japanese'),
    imageUrl: extractImage(head),
    synopsis: capture(head, /<p itemprop="description">([\s\S]*?)<\/p>/i),
    type: plainLabelValue(head, 'Type'),
    episodes: numeric(plainLabelValue(head, 'Episodes')),
    status: plainLabelValue(head, 'Status'),
    aired: plainLabelValue(head, 'Aired'),
    studios: anchorTexts(rawLabelBlock(head, 'Studios', 'Studio')),
    genres: anchorTexts(rawLabelBlock(head, 'Genres', 'Genre')),
    themes: anchorTexts(rawLabelBlock(head, 'Themes', 'Theme')),
    duration: plainLabelValue(head, 'Duration'),
    rating: plainLabelValue(head, 'Rating'),
    score: numeric(capture(head, /<span itemprop="ratingValue"[^>]*>([\d.]+)<\/span>/i)),
    rank: rankedValue(head, 'Ranked'),
    popularity: rankedValue(head, 'Popularity'),
    members: numeric(plainLabelValue(head, 'Members')),
    favorites: numeric(plainLabelValue(head, 'Favorites')),
    source: plainLabelValue(head, 'Source'),
    relations: extractRelations(html),
    externalLinks: extractExternalLinks(html),
    streaming: extractStreaming(html),
    fetchedAt,
  };
  const validated = animeDetailSchema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_anime_detail');
  return validated.data;
}
