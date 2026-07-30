import { z } from 'zod';
import type { CharacterDetail } from '../domain/character';
import { capture, decodeHtml, numeric, ParserError } from './html';

const characterDetailSchema = z.object({
  malId: z.number().int().positive(),
  name: z.string().min(1),
  nameKanji: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  about: z.string().nullable(),
  favorites: z.number().nullable(),
  fetchedAt: z.string().datetime(),
});

function extractImage(html: string): string | null {
  const tag = html.match(/<img[^>]*class="portrait[^"]*"[^>]*>/i)?.[0];
  if (!tag) return null;
  return tag.match(/\sdata-src="([^"]+)"/i)?.[1] ?? tag.match(/\ssrc="([^"]+)"/i)?.[1] ?? null;
}

function extractAbout(html: string): string | null {
  const headerIndex = html.indexOf('normal_header" style="height: 15px;"');
  if (headerIndex === -1) return null;
  const closeTagIndex = html.indexOf('</h2>', headerIndex);
  if (closeTagIndex === -1) return null;
  const nextSectionIndex = html.indexOf('class="normal_header"', closeTagIndex);
  const block = html.slice(closeTagIndex + '</h2>'.length, nextSectionIndex === -1 ? closeTagIndex + 4_000 : nextSectionIndex);
  const decoded = decodeHtml(block);
  return decoded.length > 0 ? decoded : null;
}

export function parseCharacterDetail(html: string, malId: number, fetchedAt = new Date().toISOString()): CharacterDetail {
  const head = html.slice(0, 60_000);
  const name = capture(head, /<h1[^>]*class="title-name[^"]*"[^>]*>\s*<strong>([^<]+)<\/strong>/i);
  const detail: CharacterDetail = {
    malId,
    name: name ?? '',
    nameKanji: capture(head, /<small>\(([^)]+)\)<\/small>/i),
    imageUrl: extractImage(head),
    about: extractAbout(head),
    favorites: numeric(capture(head, /Member Favorites:\s*([\d,]+)/i)),
    fetchedAt,
  };
  const validated = characterDetailSchema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_character_detail');
  return validated.data;
}
