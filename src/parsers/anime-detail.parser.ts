import { z } from 'zod';
import type { AnimeDetail, Broadcast, Trailer } from '../domain/anime';
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
import { extractExternalLinks, extractRelations, extractStreaming } from './relations-links';

const relationSchema = z.object({
  relation: z.string().min(1),
  malId: z.number().int().positive(),
  type: z.enum(['anime', 'manga']),
  title: z.string().min(1),
});
const externalLinkSchema = z.object({ name: z.string().min(1), url: z.string().url() });
const streamingSchema = z.object({ name: z.string().min(1), url: z.string().url(), available: z.boolean() });

const animeDetailSchema = z.object({
  malId: z.number().int().positive(),
  url: z.string().url().nullable(),
  title: z.string().min(1),
  titleEnglish: z.string().nullable(),
  titleJapanese: z.string().nullable(),
  titleSynonyms: z.array(z.string()),
  imageUrl: z.string().url().nullable(),
  images: imageSetSchema,
  trailer: z.object({
    youtubeId: z.string().nullable(),
    url: z.string().url().nullable(),
    embedUrl: z.string().url().nullable(),
  }),
  synopsis: z.string().nullable(),
  background: z.string().nullable(),
  type: z.string().nullable(),
  episodes: z.number().nullable(),
  status: z.string().nullable(),
  airing: z.boolean(),
  aired: dateRangeSchema,
  season: z.string().nullable(),
  year: z.number().nullable(),
  broadcast: z.object({
    day: z.string().nullable(),
    time: z.string().nullable(),
    timezone: z.string().nullable(),
    string: z.string().nullable(),
  }),
  studios: z.array(malRefSchema),
  producers: z.array(malRefSchema),
  licensors: z.array(malRefSchema),
  genres: z.array(malRefSchema),
  themes: z.array(malRefSchema),
  demographics: z.array(malRefSchema),
  duration: z.string().nullable(),
  rating: z.string().nullable(),
  score: z.number().nullable(),
  scoredBy: z.number().nullable(),
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

// "Premiered: <a href=".../season/1998/spring">Spring 1998</a>". Absent for movies and for anything
// that never had a TV season, which is why both halves are nullable.
function premiered(html: string): { season: string | null; year: number | null } {
  const text = labelValue(html, 'Premiered');
  const match = text?.match(/^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i);
  if (!match) return { season: null, year: null };
  return { season: match[1].toLowerCase(), year: Number(match[2]) };
}

// "Broadcast: Saturdays at 01:00 (JST)" — plain text, no markup to anchor on, and frequently
// "Unknown" or absent entirely.
function broadcast(html: string): Broadcast {
  const raw = labelValue(html, 'Broadcast');
  if (!raw || /^unknown$/i.test(raw)) return { day: null, time: null, timezone: null, string: raw ?? null };
  const match = raw.match(/^(\w+?)s?\s+at\s+(\d{1,2}:\d{2})\s*\(([^)]+)\)/i);
  if (!match) return { day: null, time: null, timezone: null, string: raw };
  return { day: `${match[1]}s`, time: match[2], timezone: match[3], string: raw };
}

// The promo block links a youtube-nocookie embed; the watch URL is derived from the id rather than
// present on the page.
function trailer(html: string): Trailer {
  const embedUrl =
    html.match(/video-promotion[\s\S]{0,300}?href="(https:\/\/www\.youtube-nocookie\.com\/embed\/[^"]+)"/i)?.[1] ??
    null;
  const youtubeId = embedUrl?.match(/embed\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
  return { youtubeId, url: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null, embedUrl };
}

export function parseAnimeDetail(html: string, malId: number, fetchedAt = new Date().toISOString()): AnimeDetail {
  const head = html.slice(0, 90_000);
  const title = capture(head, /<h1[^>]*class="title-name[^"]*"[^>]*>\s*<strong>([^<]+)<\/strong>/i);
  const imageUrl = taggedImage(head, COVER_IMAGE);
  const status = labelValue(head, 'Status');
  const { season, year } = premiered(head);
  const detail: AnimeDetail = {
    malId,
    url: canonicalUrl(head),
    title: title ?? '',
    titleEnglish: labelValue(head, 'English'),
    titleJapanese: labelValue(head, 'Japanese'),
    titleSynonyms: titleSynonyms(head),
    imageUrl,
    images: imageVariants(imageUrl, 'anime'),
    trailer: trailer(head),
    synopsis: richCapture(head, /<p itemprop="description">([\s\S]*?)<\/p>/i),
    background: backgroundSection(html),
    type: labelValue(head, 'Type'),
    episodes: numeric(labelValue(head, 'Episodes')),
    status,
    airing: status === 'Currently Airing',
    aired: parseDateRange(labelValue(head, 'Aired')),
    season,
    year,
    broadcast: broadcast(head),
    studios: anchorRefs(labelBlock(head, 'Studios', 'Studio')),
    producers: anchorRefs(labelBlock(head, 'Producers', 'Producer')),
    licensors: anchorRefs(labelBlock(head, 'Licensors', 'Licensor')),
    genres: anchorRefs(labelBlock(head, 'Genres', 'Genre')),
    themes: anchorRefs(labelBlock(head, 'Themes', 'Theme')),
    demographics: anchorRefs(labelBlock(head, 'Demographics', 'Demographic')),
    duration: labelValue(head, 'Duration'),
    rating: labelValue(head, 'Rating'),
    score: numeric(capture(head, /<span itemprop="ratingValue"[^>]*>([\d.]+)<\/span>/i)),
    scoredBy: numeric(capture(head, /<span itemprop="ratingCount"[^>]*>([\d,]+)<\/span>/i)),
    rank: rankedValue(head, 'Ranked'),
    popularity: rankedValue(head, 'Popularity'),
    members: numeric(labelValue(head, 'Members')),
    favorites: numeric(labelValue(head, 'Favorites')),
    source: labelValue(head, 'Source'),
    relations: extractRelations(html),
    externalLinks: extractExternalLinks(html),
    streaming: extractStreaming(html),
    fetchedAt,
  };
  const validated = animeDetailSchema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_anime_detail');
  return validated.data;
}
