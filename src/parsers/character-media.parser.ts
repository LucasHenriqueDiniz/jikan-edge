import { z } from 'zod';
import type { CharacterMediaEntry } from '../domain/character-media';
import type { VoiceActor } from '../domain/voice-actor';
import { decodeHtml, imageFrom } from './html';

const mediaSchema = z.object({
  malId: z.number().int().positive(),
  title: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  role: z.string().nullable(),
});
const voiceActorSchema = z.object({
  malId: z.number().int().positive(),
  name: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  language: z.string().nullable(),
});

function extractMedia(block: string, type: 'anime' | 'manga'): CharacterMediaEntry[] {
  const entries: CharacterMediaEntry[] = [];
  const linkPattern = new RegExp(`${type}/(\\d+)/([^"]*)"`, 'i');
  const titlePattern = new RegExp(`${type}/\\d+/[^"]*">([^<]+)<\\/a>`, 'i');
  for (const row of block.split('<tr>').slice(1)) {
    const idMatch = row.match(linkPattern);
    if (!idMatch) continue;
    const title = decodeHtml(row.match(titlePattern)?.[1] ?? '');
    const imageUrl = imageFrom(row);
    const role = decodeHtml(row.match(/<small>([^<]+)<\/small>/i)?.[1] ?? '') || null;
    const parsed = mediaSchema.safeParse({ malId: Number(idMatch[1]), title, imageUrl, role });
    if (parsed.success) entries.push(parsed.data);
  }
  return entries;
}

// Both sections use the exact same row shape (image + title link + <small> role/language tag);
// they only differ in whether the links point at /anime/ or /manga/, and where each section
// starts/ends. A character can legitimately have zero entries in either (manga-only characters
// have no animeography, original characters have no mangaography), so this never throws on empty.
export function parseCharacterAnimeography(html: string): CharacterMediaEntry[] {
  const start = html.indexOf('character-anime">Animeography</div>');
  if (start === -1) return [];
  const end = html.indexOf('character-manga">Mangaography</div>', start);
  return extractMedia(html.slice(start, end === -1 ? start + 20_000 : end), 'anime');
}

export function parseCharacterMangaography(html: string): CharacterMediaEntry[] {
  const start = html.indexOf('character-manga">Mangaography</div>');
  if (start === -1) return [];
  const end = html.indexOf('>Voice Actors</div>', start);
  return extractMedia(html.slice(start, end === -1 ? start + 20_000 : end), 'manga');
}

export function parseCharacterVoiceActors(html: string): VoiceActor[] {
  const start = html.indexOf('>Voice Actors</div>');
  if (start === -1) return [];
  const voiceActors: VoiceActor[] = [];
  for (const row of html.slice(start).split('<tr>').slice(1)) {
    const idMatch = row.match(/people\/(\d+)\/([^"]*)"/i);
    if (!idMatch) continue;
    const name = decodeHtml(row.match(/people\/\d+\/[^"]*">([^<]+)<\/a>/i)?.[1] ?? '');
    const imageUrl = imageFrom(row);
    const language = decodeHtml(row.match(/<small>([^<]+)<\/small>/i)?.[1] ?? '') || null;
    const parsed = voiceActorSchema.safeParse({ malId: Number(idMatch[1]), name, imageUrl, language });
    if (parsed.success) voiceActors.push(parsed.data);
  }
  return voiceActors;
}
