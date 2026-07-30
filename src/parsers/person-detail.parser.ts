import { z } from 'zod';
import type { PersonDetail } from '../domain/person';
import { capture, numeric, ParserError } from './html';

const personDetailSchema = z.object({
  malId: z.number().int().positive(),
  name: z.string().min(1),
  givenName: z.string().nullable(),
  familyName: z.string().nullable(),
  alternateNames: z.string().nullable(),
  birthday: z.string().nullable(),
  website: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  about: z.string().nullable(),
  favorites: z.number().nullable(),
  fetchedAt: z.string().datetime(),
});

// Some fields (notably "Family name") are not individually wrapped in their own <div>, so a plain
// "up to the next </div>" capture can overrun into the following field. Stop at whichever comes
// first: the next tag open or close.
function labelValue(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return capture(html, new RegExp(`${escaped}:<\\/span>([\\s\\S]*?)(?:<div|<\\/div>)`, 'i'));
}

function extractImage(html: string): string | null {
  const tag = html.match(/<img[^>]*data-src="[^"]*\/voiceactors\/[^"]*"[^>]*>/i)?.[0];
  return tag?.match(/\sdata-src="([^"]+)"/i)?.[1] ?? null;
}

function extractWebsite(html: string): string | null {
  const block = html.match(/Website:<\/span>([\s\S]*?)(?:<div|<\/div>)/i)?.[1];
  const href = block?.match(/<a href="([^"]+)"/i)?.[1];
  return href && href !== 'http://' && href !== 'https://' ? href : null;
}

export function parsePersonDetail(html: string, malId: number, fetchedAt = new Date().toISOString()): PersonDetail {
  const head = html.slice(0, 60_000);
  const name = capture(head, /<h1[^>]*class="title-name[^"]*"[^>]*>\s*<strong>([^<]+)<\/strong>/i);
  const detail: PersonDetail = {
    malId,
    name: name ?? '',
    givenName: labelValue(head, 'Given name'),
    familyName: labelValue(head, 'Family name'),
    alternateNames: labelValue(head, 'Alternate names'),
    birthday: labelValue(head, 'Birthday'),
    website: extractWebsite(head),
    imageUrl: extractImage(head),
    about: capture(head, /js-people-informantion-more">([\s\S]*?)<\/div>/i),
    favorites: numeric(labelValue(head, 'Member Favorites')),
    fetchedAt,
  };
  const validated = personDetailSchema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_person_detail');
  return validated.data;
}
