import { z } from 'zod';
import type { EpisodeVideoEntry, PromoVideoEntry, TitleVideos } from '../domain/videos';
import { decodeHtml, imageFrom } from './html';

const episodeSchema = z.object({ episode: z.number().int().positive(), title: z.string().nullable(), url: z.string().url(), imageUrl: z.string().url().nullable() });
const promoSchema = z.object({ title: z.string().min(1), videoUrl: z.string().url().nullable(), imageUrl: z.string().url().nullable() });

function sectionSlice(html: string, heading: string): string {
  const start = html.indexOf(`>${heading}</h2>`);
  if (start === -1) return '';
  const rest = html.slice(start);
  const nextHeading = rest.slice(20).search(/<h2[ >]/i);
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading + 20);
}

function parsePromoBlocks(section: string): PromoVideoEntry[] {
  const promos: PromoVideoEntry[] = [];
  for (const chunk of section.split('js-fancybox-video').slice(1)) {
    const videoUrl = chunk.slice(0, 400).match(/href="([^"]+)"/i)?.[1] ?? null;
    const imageUrl = imageFrom(chunk);
    const title = decodeHtml(chunk.match(/data-title="([^"]*)"/i)?.[1] ?? '');
    const parsed = promoSchema.safeParse({ title, videoUrl, imageUrl });
    if (parsed.success) promos.push(parsed.data);
  }
  return promos;
}

export function parseEpisodeVideos(html: string): EpisodeVideoEntry[] {
  const section = sectionSlice(html, 'Episodes');
  const episodes: EpisodeVideoEntry[] = [];
  const seen = new Set<number>();
  for (const chunk of section.split('<a class="video-list di-ib po-r"').slice(1)) {
    const urlMatch = chunk.match(/^\s*href="(https:\/\/myanimelist\.net\/anime\/\d+\/[^"]*\/episode\/(\d+))"/i);
    if (!urlMatch) continue;
    const episode = Number(urlMatch[2]);
    if (seen.has(episode)) continue;
    seen.add(episode);
    const imageUrl = imageFrom(chunk);
    const title = decodeHtml(chunk.match(/data-title="([^"]*)"/i)?.[1] ?? '') || null;
    const parsed = episodeSchema.safeParse({ episode, title, url: urlMatch[1], imageUrl });
    if (parsed.success) episodes.push(parsed.data);
  }
  return episodes;
}

export function parseTitleVideos(html: string): TitleVideos {
  return {
    promos: parsePromoBlocks(sectionSlice(html, 'Trailers')),
    musicVideos: parsePromoBlocks(sectionSlice(html, 'Music Videos')),
    episodes: parseEpisodeVideos(html),
  };
}
