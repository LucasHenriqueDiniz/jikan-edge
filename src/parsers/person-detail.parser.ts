import { z } from 'zod';
import type { PersonDetail } from '../domain/person';
import {
  canonicalUrl,
  capture,
  imageSetSchema,
  imageVariants,
  numeric,
  ParserError,
  richCapture,
  taggedImage,
  VOICE_ACTOR_IMAGE,
} from './html';

const personDetailSchema = z.object({
  malId: z.number().int().positive(),
  url: z.string().url().nullable(),
  name: z.string().min(1),
  givenName: z.string().nullable(),
  familyName: z.string().nullable(),
  alternateNames: z.string().nullable(),
  birthday: z.string().nullable(),
  website: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  images: imageSetSchema,
  about: z.string().nullable(),
  favorites: z.number().nullable(),
  fetchedAt: z.string().datetime(),
});

// Deliberately NOT the shared `labelValue` from html.ts: some fields here (notably "Family name")
// are not individually wrapped in their own <div>, so the shared "up to the next </div>" capture
// overruns into the following field. Stop at whichever comes first — the next tag open or close.
function tightLabelValue(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return capture(html, new RegExp(`${escaped}:<\\/span>([\\s\\S]*?)(?:<div|<\\/div>)`, 'i'));
}

function extractWebsite(html: string): string | null {
  const block = html.match(/Website:<\/span>([\s\S]*?)(?:<div|<\/div>)/i)?.[1];
  const href = block?.match(/<a href="([^"]+)"/i)?.[1];
  return href && href !== 'http://' && href !== 'https://' ? href : null;
}

export function parsePersonDetail(html: string, malId: number, fetchedAt = new Date().toISOString()): PersonDetail {
  const head = html.slice(0, 60_000);
  const name = capture(head, /<h1[^>]*class="title-name[^"]*"[^>]*>\s*<strong>([^<]+)<\/strong>/i);
  const imageUrl = taggedImage(head, VOICE_ACTOR_IMAGE);
  const detail: PersonDetail = {
    malId,
    url: canonicalUrl(head),
    name: name ?? '',
    givenName: tightLabelValue(head, 'Given name'),
    familyName: tightLabelValue(head, 'Family name'),
    alternateNames: tightLabelValue(head, 'Alternate names'),
    birthday: tightLabelValue(head, 'Birthday'),
    website: extractWebsite(head),
    imageUrl,
    images: imageVariants(imageUrl, 'person'),
    about: richCapture(head, /js-people-informantion-more">([\s\S]*?)<\/div>/i),
    favorites: numeric(tightLabelValue(head, 'Member Favorites')),
    fetchedAt,
  };
  const validated = personDetailSchema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_person_detail');
  return validated.data;
}
