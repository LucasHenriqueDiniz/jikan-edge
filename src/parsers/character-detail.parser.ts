import { z } from 'zod';
import type { CharacterDetail } from '../domain/character';
import {
  canonicalUrl,
  capture,
  imageSetSchema,
  imageVariants,
  numeric,
  ParserError,
  PORTRAIT_IMAGE,
  richText,
  spanBetween,
  taggedImage,
} from './html';

export const characterDetailSchema = z.object({
  malId: z.number().int().positive(),
  url: z.string().url().nullable(),
  name: z.string().min(1),
  nicknames: z.array(z.string().min(1)),
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

// The heading reads `Luffy "Mugiwara, Straw Hat" Monkey D.`: the nicknames are the quoted run in
// the middle, comma-separated, and the name is what is left once it is taken out — the same string
// MAL puts in `og:title`. Serving the heading whole put the nicknames inside `name`.
function splitHeading(heading: string): { name: string; nicknames: string[] } {
  const quoted = heading.match(/"([^"]*)"/);
  const nicknames = (quoted?.[1] ?? '')
    .split(',')
    .map((nickname) => nickname.trim())
    .filter(Boolean);
  const name = (quoted ? heading.replace(quoted[0], ' ') : heading).replace(/\s+/g, ' ').trim();
  return { name, nicknames };
}

// Every field is read relative to its own marker rather than from a fixed prefix. The page used to
// be read as `html.slice(0, 60_000)`, and on long pages the About block — kanji name, favourites and
// the text itself — sits well past that: 77 KB to 112 KB on five of the six characters measured on
// 2026-10-11, all of which were served with those three fields null.
export function parseCharacterDetail(
  html: string,
  malId: number,
  fetchedAt = new Date().toISOString(),
): CharacterDetail {
  const heading = capture(html, /<h1[^>]*class="title-name[^"]*"[^>]*>\s*<strong>([^<]+)<\/strong>/i);
  const { name, nicknames } = splitHeading(heading ?? '');
  const imageUrl = taggedImage(html, PORTRAIT_IMAGE);
  const aboutHeading = spanBetween(html, 'normal_header" style="height: 15px;"', '</h2>') ?? '';
  const favoritesAt = html.indexOf('Member Favorites:');
  const detail: CharacterDetail = {
    malId,
    url: canonicalUrl(html),
    name,
    nicknames,
    nameKanji: capture(aboutHeading, /<small>\(([^)]+)\)<\/small>/i),
    imageUrl,
    images: imageVariants(imageUrl, 'character'),
    about: extractAbout(html),
    favorites:
      favoritesAt === -1
        ? null
        : numeric(capture(html.slice(favoritesAt, favoritesAt + 64), /Member Favorites:\s*([\d,]+)/i)),
    fetchedAt,
  };
  const validated = characterDetailSchema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_character_detail');
  return validated.data;
}
