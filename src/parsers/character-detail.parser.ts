import { z } from 'zod';
import type { CharacterDetail } from '../domain/character';
import { canonicalUrl, capture, imageSetSchema, imageVariants, numeric, ParserError, PORTRAIT_IMAGE, richText, taggedImage } from './html';

const characterDetailSchema = z.object({
  malId: z.number().int().positive(),
  url: z.string().url().nullable(),
  name: z.string().min(1),
  nameKanji: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  images: imageSetSchema,
  about: z.string().nullable(),
  favorites: z.number().nullable(),
  fetchedAt: z.string().datetime(),
});

function extractAbout(html: string): string | null {
  const headerIndex = html.indexOf('normal_header" style="height: 15px;"');
  if (headerIndex === -1) return null;
  const closeTagIndex = html.indexOf('</h2>', headerIndex);
  if (closeTagIndex === -1) return null;
  const nextSectionIndex = html.indexOf('class="normal_header"', closeTagIndex);
  // No fixed byte budget: when "About" is the last normal_header section on the page (a character
  // with no voice actors or anime/manga appearances following it), cut only at the end of the
  // document instead of an arbitrary window — the same fixed-budget mistake already paid for in
  // parseStaff and backgroundSection.
  const block = html.slice(closeTagIndex + '</h2>'.length, nextSectionIndex === -1 ? undefined : nextSectionIndex);
  const decoded = richText(block);
  return decoded.length > 0 ? decoded : null;
}

export function parseCharacterDetail(html: string, malId: number, fetchedAt = new Date().toISOString()): CharacterDetail {
  const head = html.slice(0, 60_000);
  const name = capture(head, /<h1[^>]*class="title-name[^"]*"[^>]*>\s*<strong>([^<]+)<\/strong>/i);
  const imageUrl = taggedImage(head, PORTRAIT_IMAGE);
  const detail: CharacterDetail = {
    malId,
    url: canonicalUrl(head),
    name: name ?? '',
    nameKanji: capture(head, /<small>\(([^)]+)\)<\/small>/i),
    imageUrl,
    images: imageVariants(imageUrl, 'character'),
    about: extractAbout(head),
    favorites: numeric(capture(head, /Member Favorites:\s*([\d,]+)/i)),
    fetchedAt,
  };
  const validated = characterDetailSchema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_character_detail');
  return validated.data;
}
