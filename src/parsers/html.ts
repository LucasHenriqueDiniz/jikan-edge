import { z } from 'zod';
import type { ImageKind, ImageSet } from '../domain/image';
import type { MalRef } from '../domain/mal-ref';

export type { ImageKind, ImageSet, MalRef };

// The named entities MAL actually emits in prose. Anything outside this table is left alone rather
// than guessed at — a wrong character is worse than a visible `&frac34;`.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>',
  mdash: '—', ndash: '–', hellip: '…', middot: '·', bull: '•',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  deg: '°', times: '×', frac12: '½', prime: '′', Prime: '″',
  laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™',
};

// Tags are stripped BEFORE entities are decoded, and the order is load-bearing: decoding first
// turns a literal `&lt;b&gt;` written by a user into a real `<b>`, which the tag stripper then
// eats. Stripping first means an entity can never be mistaken for markup.
function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z][a-z0-9]*);/gi, (whole, name: string) => NAMED_ENTITIES[name] ?? whole);
}

export function decodeHtml(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// Same decoding, but paragraph structure survives. MAL separates paragraphs inside a synopsis with
// `<br>`, and `decodeHtml` flattens all of them into spaces — which is how every synopsis this API
// served came out as one wall of text. Only the long-form fields need this.
export function richText(value: string): string {
  const withBreaks = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(withBreaks)
    .replace(/[^\S\n]+/g, ' ')       // collapse spaces/tabs, never newlines
    .replace(/[^\S\n]*\n[^\S\n]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// MAL's CDN serves a resized copy under `/r/{width}x{height}/`, signed with `?s=`. That resize is
// what the list pages embed, so every list route in this API was publishing a 50x70 stamp (2 KB)
// where a 56 KB poster exists at the same path. Dropping both segments yields the original.
export function originalImage(url: string): string;
export function originalImage(url: null): null;
export function originalImage(url: string | null): string | null;
export function originalImage(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/\/r\/\d+x\d+(?=\/)/, '').replace(/\?s=[^&]*$/, '');
}

// The suffixes are NOT uniform across entity types (see domain/image.ts), so deriving them blindly
// would publish 404s:
//   anime, manga    `t` and `l`           character       `t` only (`l` is 404)
//   person          `l` only (`t` is 404) producer, club  neither
const VARIANTS: Record<ImageKind, { small: boolean; large: boolean }> = {
  anime: { small: true, large: true },
  manga: { small: true, large: true },
  character: { small: true, large: false },
  person: { small: false, large: true },
};

function withSuffix(url: string, suffix: string): string | null {
  // Producer logos have no file extension at all, so there is nothing to suffix.
  return /\.(jpg|jpeg|png|webp)$/i.test(url) ? url.replace(/\.(jpg|jpeg|png|webp)$/i, `${suffix}.$1`) : null;
}

export function imageVariants(url: string | null, kind: ImageKind): ImageSet {
  const medium = originalImage(url);
  if (!medium) return { small: null, medium: null, large: null };
  const allowed = VARIANTS[kind];
  return {
    small: allowed.small ? withSuffix(medium, 't') : null,
    medium,
    large: allowed.large ? withSuffix(medium, 'l') : null,
  };
}

export function capture(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : null;
}

// `capture` for the long-form fields, where paragraph breaks are part of the content.
export function richCapture(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  if (!match?.[1]) return null;
  return richText(match[1]) || null;
}

export const imageSetSchema = z.object({
  small: z.string().url().nullable(),
  medium: z.string().url().nullable(),
  large: z.string().url().nullable(),
});

export function numeric(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

// MAL lazy-loads images: the real URL lives in `data-src` and `src` usually holds a spacer. The
// fallback order matters — reading `src` first would return the spacer on every lazy-loaded row.
// The result is normalised to the full-size image; `new URL` is only a validity guard, because a
// relative or non-https value would fail `z.string().url()` further down anyway.
// `pictures.parser.ts` deliberately does NOT come through here: there the thumbnail is a field of
// its own, so it has to survive.
export function imageFrom(html: string): string | null {
  const candidate = /\sdata-src="([^"]+)"/i.exec(html)?.[1]
    ?? /\sdata-srcset="([^\s,"]+)/i.exec(html)?.[1]
    ?? /\ssrcset="([^\s,"]+)/i.exec(html)?.[1]
    ?? /\ssrc="([^"]+)"/i.exec(html)?.[1];
  if (!candidate || /spacer\.gif|placeholder/i.test(candidate)) return null;
  try { return new URL(candidate).protocol === 'https:' ? originalImage(candidate) : null; } catch { return null; }
}

// Detail pages carry several images (cover, sidebar ads, related entries), so the cover has to be
// isolated by its own tag before extracting. Each entity anchors on something different — that
// anchor is the only part that varies between the six detail parsers.
export function taggedImage(html: string, anchor: RegExp): string | null {
  const tag = html.match(anchor)?.[0];
  return tag ? imageFrom(tag) : null;
}

export const COVER_IMAGE = /<img[^>]*itemprop="image"[^>]*>/i;
export const PORTRAIT_IMAGE = /<img[^>]*class="portrait[^"]*"[^>]*>/i;
export const VOICE_ACTOR_IMAGE = /<img[^>]*data-src="[^"]*\/voiceactors\/[^"]*"[^>]*>/i;
export const COMPANY_LOGO_IMAGE = /<img[^>]*data-src="[^"]*company_logos[^"]*"[^>]*>/i;

function escapeLabel(label: string): string {
  return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// MAL labels a sidebar field as `<span class="dark_text">Label:</span>` followed by the value.
// Several labels are singular or plural depending on how many values there are ("Studio" vs
// "Studios"), hence the variadic form: the first label that matches wins.
export function labelValue(html: string, ...labels: string[]): string | null {
  for (const label of labels) {
    const value = capture(html, new RegExp(`${escapeLabel(label)}:<\\/span>([\\s\\S]*?)<\\/div>`, 'i'));
    if (value !== null) return value;
  }
  return null;
}

// Same lookup, but returns the raw HTML instead of decoded text — needed wherever the anchors
// inside the block still carry information (the MAL id in the href, for one).
export function labelBlock(html: string, ...labels: string[]): string {
  for (const label of labels) {
    const match = html.match(new RegExp(`${escapeLabel(label)}:<\\/span>([\\s\\S]*?)<\\/div>`, 'i'));
    if (match) return match[1];
  }
  return '';
}

// Ranked/Popularity print as `#49`, unlike every other numeric field.
export function rankedValue(html: string, label: string): number | null {
  return numeric(capture(html, new RegExp(`${escapeLabel(label)}:<\\/span>\\s*#([\\d,]+)`, 'i')));
}

export function anchorTexts(block: string): string[] {
  return [...block.matchAll(/<a[^>]*>([^<]+)<\/a>/gi)].map((match) => decodeHtml(match[1]));
}

export const malRefSchema = z.object({
  malId: z.number().int().positive(),
  name: z.string().min(1),
  url: z.string().url(),
});

// Same anchors `anchorTexts` reads, but keeping the id and the link instead of throwing them away.
// Sidebar hrefs are relative (`/anime/genre/1/Action`) while list pages use absolute ones, so both
// forms are accepted. An anchor whose href does not carry an id is skipped rather than emitted
// with a fabricated one.
export function anchorRefs(block: string): MalRef[] {
  const refs: MalRef[] = [];
  for (const match of block.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi)) {
    const [, href, text] = match;
    const malId = Number(href.match(/\/(\d+)(?:\/|$)/)?.[1]);
    const name = decodeHtml(text);
    if (!Number.isInteger(malId) || malId <= 0 || !name) continue;
    refs.push({ malId, name, url: href.startsWith('http') ? href : `${MAL_BASE}${href}` });
  }
  return refs;
}

const MAL_BASE = 'https://myanimelist.net';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// MAL writes an airing range as one human string: "Apr 3, 1998 to Apr 24, 1999", "Aug 25, 1989 to ?",
// "2024", "Not available". Only a complete day/month/year is turned into a date — a partial one
// stays `null` rather than being padded to an invented January 1st. `string` always carries what
// the page said, so nothing is lost by being strict here.
function isoDate(raw: string): string | null {
  const match = raw.trim().match(/^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

export const dateRangeSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
  string: z.string().nullable(),
});

export function parseDateRange(raw: string | null): { from: string | null; to: string | null; string: string | null } {
  if (!raw) return { from: null, to: null, string: null };
  const [start, end] = raw.split(/\s+to\s+/i);
  return { from: isoDate(start ?? ''), to: end ? isoDate(end) : null, string: raw };
}

// The curated "Background" section, which most titles do not have. Anchored on the heading id and
// stopped at the next heading — not at a byte budget, which is the mistake this codebase has
// already paid for twice in the profile parser.
export function backgroundSection(html: string): string | null {
  const start = html.search(/<h2[^>]*id="background"/i);
  if (start === -1) return null;
  const rest = html.slice(start);
  const bodyStart = rest.indexOf('</h2>');
  if (bodyStart === -1) return null;
  const body = rest.slice(bodyStart + '</h2>'.length);
  const end = body.search(/<h2|<div class="border_solid"/i);
  return richText(end === -1 ? body : body.slice(0, end)) || null;
}

export function titleSynonyms(html: string): string[] {
  const raw = labelValue(html, 'Synonyms', 'Synonym');
  return raw ? raw.split(',').map((part) => part.trim()).filter(Boolean) : [];
}

// The canonical URL, with slug, that MAL puts on every page. Confirmed present on all seven detail
// pages: anime, manga, character, person and producer carry both `<link rel="canonical">` and
// `og:url`; club and profile carry only `og:url`, so that is the one to read.
export function canonicalUrl(html: string): string | null {
  const url = html.match(/<meta property="og:url" content="([^"]+)"/i)?.[1]
    ?? html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
  return url?.startsWith('https://myanimelist.net/') ? url : null;
}

export class ParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParserError';
  }
}
