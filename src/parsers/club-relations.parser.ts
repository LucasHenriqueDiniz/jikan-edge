import { z } from 'zod';
import { decodeHtml } from './html';

export interface ClubRelations {
  anime: { malId: number; title: string }[];
  manga: { malId: number; title: string }[];
  characters: { malId: number; name: string }[];
}
export const CLUB_RELATIONS_PARSER_VERSION = 'club-relations-html-v2';

const titleSchema = z.object({ malId: z.number().int().positive(), title: z.string().min(1) });
const charSchema = z.object({ malId: z.number().int().positive(), name: z.string().min(1) });

function section(html: string, heading: string): string {
  const start = html.indexOf(`${heading}</div>`);
  if (start === -1) return '';
  const rest = html.slice(start);
  const end = rest.indexOf('<div class="normal_header">', heading.length);
  return end === -1 ? rest.slice(0, 40_000) : rest.slice(0, end);
}

function extract(block: string, type: 'anime' | 'manga' | 'character'): { malId: number; text: string }[] {
  const pattern = new RegExp(`<a href="${type}/(\\d+)">([^<]+)</a>`, 'gi');
  const out: { malId: number; text: string }[] = [];
  for (const match of block.matchAll(pattern)) out.push({ malId: Number(match[1]), text: decodeHtml(match[2]) });
  return out;
}

export function parseClubRelations(html: string): ClubRelations {
  const anime = extract(section(html, 'Anime Relations'), 'anime').map((item) => ({
    malId: item.malId,
    title: item.text,
  }));
  const manga = extract(section(html, 'Manga Relations'), 'manga').map((item) => ({
    malId: item.malId,
    title: item.text,
  }));
  const characters = extract(section(html, 'Character Relations'), 'character').map((item) => ({
    malId: item.malId,
    name: item.text,
  }));
  return {
    anime: anime.filter((item) => titleSchema.safeParse(item).success),
    manga: manga.filter((item) => titleSchema.safeParse(item).success),
    characters: characters.filter((item) => charSchema.safeParse(item).success),
  };
}
