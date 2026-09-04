import { z } from 'zod';
import type { PublishedManga, StaffPosition, VoiceActingRole } from '../domain/person-media';
import { decodeHtml, imageFrom } from './html';

const staffSchema = z.object({
  animeId: z.number().int().positive(),
  animeTitle: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  positions: z.array(z.string()),
});
const mangaSchema = z.object({
  mangaId: z.number().int().positive(),
  mangaTitle: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  positions: z.array(z.string()),
});
const voiceSchema = z.object({
  animeId: z.number().int().positive(),
  animeTitle: z.string().min(1),
  animeImageUrl: z.string().url().nullable(),
  characterId: z.number().int().positive(),
  characterName: z.string().min(1),
  characterRole: z.string().nullable(),
  characterImageUrl: z.string().url().nullable(),
});

function splitPositions(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => decodeHtml(part.trim()))
    .filter(Boolean);
}

// Anime staff positions and published manga credits share the exact same row shape (image +
// title link + comma-separated <small> roles), just under different row classes and /anime/
// vs /manga/ links — the row's own class already disambiguates which table it belongs to, so
// no section-boundary bookkeeping is needed; we can scan the whole document for each marker.
export function parsePersonAnimeStaff(html: string): StaffPosition[] {
  const entries: StaffPosition[] = [];
  for (const row of html.split('<tr class="js-people-staff ').slice(1)) {
    const idMatch = row.match(/anime\/(\d+)\/([^"]*)"/i);
    if (!idMatch) continue;
    const animeTitle = decodeHtml(row.match(/class="js-people-title">([^<]+)<\/a>/i)?.[1] ?? '');
    const imageUrl = imageFrom(row);
    const positions = splitPositions(row.match(/<small>([^<]+)<\/small>/i)?.[1] ?? '');
    const parsed = staffSchema.safeParse({ animeId: Number(idMatch[1]), animeTitle, imageUrl, positions });
    if (parsed.success) entries.push(parsed.data);
  }
  return entries;
}

export function parsePersonManga(html: string): PublishedManga[] {
  const entries: PublishedManga[] = [];
  for (const row of html.split('<tr class="js-people-manga ').slice(1)) {
    const idMatch = row.match(/manga\/(\d+)\/([^"]*)"/i);
    if (!idMatch) continue;
    const mangaTitle = decodeHtml(row.match(/class="js-people-title">([^<]+)<\/a>/i)?.[1] ?? '');
    const imageUrl = imageFrom(row);
    const positions = splitPositions(row.match(/<small>([^<]+)<\/small>/i)?.[1] ?? '');
    const parsed = mangaSchema.safeParse({ mangaId: Number(idMatch[1]), mangaTitle, imageUrl, positions });
    if (parsed.success) entries.push(parsed.data);
  }
  return entries;
}

export function parsePersonVoiceActingRoles(html: string): VoiceActingRole[] {
  const roles: VoiceActingRole[] = [];
  for (const row of html.split('<tr class="js-people-character ').slice(1)) {
    const splitAt = row.indexOf('align="right" nowrap');
    if (splitAt === -1) continue;
    const animePart = row.slice(0, splitAt);
    const charPart = row.slice(splitAt);
    const animeMatch = animePart.match(/anime\/(\d+)\/([^"]*)"/i);
    const charMatch = charPart.match(/character\/(\d+)\/([^"]*)"/i);
    if (!animeMatch || !charMatch) continue;
    const animeTitle = decodeHtml(animePart.match(/class="js-people-title">([^<]+)<\/a>/i)?.[1] ?? '');
    const animeImageUrl = imageFrom(animePart);
    const characterName = decodeHtml(charPart.match(/character\/\d+\/[^"]*">([^<]+)<\/a>/i)?.[1] ?? '');
    const characterRole =
      decodeHtml(charPart.match(/<div class="spaceit_pad">([^<]+)&nbsp;<\/div>/i)?.[1] ?? '') || null;
    const characterImageUrl = imageFrom(charPart);
    const parsed = voiceSchema.safeParse({
      animeId: Number(animeMatch[1]),
      animeTitle,
      animeImageUrl,
      characterId: Number(charMatch[1]),
      characterName,
      characterRole,
      characterImageUrl,
    });
    if (parsed.success) roles.push(parsed.data);
  }
  return roles;
}
