import { z } from 'zod';
import type { CharacterRole, StaffMember, VoiceActor } from '../domain/characters-staff';
import { decodeHtml, numeric, ParserError } from './html';

const voiceActorSchema = z.object({ malId: z.number().int().positive(), name: z.string().min(1), language: z.string().nullable(), imageUrl: z.string().url().nullable() });
const characterSchema = z.object({
  malId: z.number().int().positive(), name: z.string().min(1), imageUrl: z.string().url().nullable(),
  role: z.string().nullable(), favorites: z.number().nullable(), voiceActors: z.array(voiceActorSchema),
});
const staffSchema = z.object({ malId: z.number().int().positive(), name: z.string().min(1), imageUrl: z.string().url().nullable(), role: z.string().nullable() });

function extractVoiceActors(block: string): VoiceActor[] {
  const actors: VoiceActor[] = [];
  for (const vaBlock of block.split('js-anime-character-va-lang').slice(1)) {
    const idMatch = vaBlock.match(/href="https:\/\/myanimelist\.net\/people\/(\d+)\/[^"]*">([^<]+)<\/a>/i);
    if (!idMatch) continue;
    const language = vaBlock.match(/js-anime-character-language[^>]*>([\s\S]*?)<\/div>/i)?.[1];
    const imageUrl = vaBlock.match(/data-src="([^"]+)"/i)?.[1] ?? null;
    const candidate = { malId: Number(idMatch[1]), name: decodeHtml(idMatch[2]), language: language ? decodeHtml(language) || null : null, imageUrl };
    const parsed = voiceActorSchema.safeParse(candidate);
    if (parsed.success) actors.push(parsed.data);
  }
  return actors;
}

export function parseCharacters(html: string, mediaType: 'anime' | 'manga'): CharacterRole[] {
  const marker = `class="js-${mediaType}-character-table"`;
  const characters: CharacterRole[] = [];
  for (const block of html.split(marker).slice(1)) {
    const malId = Number(block.match(/href="https:\/\/myanimelist\.net\/character\/(\d+)\//i)?.[1]);
    const nameMatch = block.match(/<h3 class="h3_character_name">([^<]*)<\/h3>/i);
    if (!malId || !nameMatch) continue;
    const name = decodeHtml(nameMatch[1]);
    const imageUrl = block.match(/data-src="([^"]+)"/i)?.[1] ?? null;
    const afterName = block.slice((nameMatch.index ?? 0) + nameMatch[0].length);
    const pads = [...afterName.matchAll(/<div class="spaceit_pad"[^>]*>([\s\S]*?)<\/div>/gi)];
    const role = pads[0] ? decodeHtml(pads[0][1]) || null : null;
    const favorites = numeric((pads[1] ? decodeHtml(pads[1][1]) : '').match(/([\d,]+)/)?.[1] ?? null);
    const voiceActors = mediaType === 'anime' ? extractVoiceActors(block) : [];
    const candidate = { malId, name, imageUrl, role, favorites, voiceActors };
    const parsed = characterSchema.safeParse(candidate);
    if (parsed.success) characters.push(parsed.data);
  }
  if (characters.length === 0) throw new ParserError('empty_characters_page');
  return characters;
}

export function parseStaff(html: string): StaffMember[] {
  const headingIdx = html.indexOf('<h2 class="h2_overwrite">Staff</h2>');
  if (headingIdx === -1) return [];
  const section = html.slice(headingIdx, headingIdx + 80_000);
  const staff: StaffMember[] = [];
  for (const row of section.split('<tr>').slice(1)) {
    const idMatch = row.match(/href="https:\/\/myanimelist\.net\/people\/(\d+)\/[^"]*">([^<]+)<\/a>/i);
    if (!idMatch) continue;
    const imageUrl = row.match(/data-src="([^"]+)"/i)?.[1] ?? null;
    const roleMatch = row.match(/<small>([^<]+)<\/small>/i);
    const candidate = { malId: Number(idMatch[1]), name: decodeHtml(idMatch[2]), imageUrl, role: roleMatch ? decodeHtml(roleMatch[1]) : null };
    const parsed = staffSchema.safeParse(candidate);
    if (parsed.success) staff.push(parsed.data);
  }
  return staff;
}
