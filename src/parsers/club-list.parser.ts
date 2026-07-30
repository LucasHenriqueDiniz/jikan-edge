import { z } from 'zod';
import type { ClubListEntry } from '../domain/club-list';
import { decodeHtml, imageFrom, ParserError } from './html';

const entrySchema = z.object({
  malId: z.number().int().positive(), title: z.string().min(1), imageUrl: z.string().url().nullable(), description: z.string().nullable(), members: z.number().nullable(),
});

export function parseClubList(html: string): ClubListEntry[] {
  const clubs: ClubListEntry[] = [];
  for (const block of html.split('<tr class="table-data">').slice(1)) {
    const idMatch = block.match(/clubs\.php\?cid=(\d+)/i);
    if (!idMatch) continue;
    const title = decodeHtml(block.match(/class="fw-b">([^<]+)<\/a>/i)?.[1] ?? '');
    const imageUrl = imageFrom(block);
    const description = decodeHtml(block.match(/class="pt4 pb4 word-break">([^<]*)<\/div>/i)?.[1] ?? '') || null;
    const membersMatch = block.match(/<td class="ac">\s*(\d+)\s*<\/td>/i);
    const candidate = { malId: Number(idMatch[1]), title, imageUrl, description, members: membersMatch ? Number(membersMatch[1]) : null };
    const parsed = entrySchema.safeParse(candidate);
    if (parsed.success) clubs.push(parsed.data);
  }
  if (clubs.length === 0) throw new ParserError('empty_club_list_page');
  return clubs;
}
