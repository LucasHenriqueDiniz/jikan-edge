import { z } from 'zod';
import type { ClubMember } from '../domain/club-member';
import { decodeHtml, ParserError } from './html';

const memberSchema = z.object({ username: z.string().min(1), url: z.string().url(), avatarUrl: z.string().url().nullable() });

export function parseClubMembers(html: string): ClubMember[] {
  const members: ClubMember[] = [];
  for (const block of html.split('<td align="center"  class="borderClass">').slice(1)) {
    const username = decodeHtml(block.match(/<a href="\/profile\/[^"]+">([^<]+)<\/a>/i)?.[1] ?? '');
    if (!username) continue;
    const avatarUrl = block.match(/class="picSurround">[\s\S]*?data-src="([^"]+)"/i)?.[1] ?? null;
    const candidate = { username, url: `https://myanimelist.net/profile/${encodeURIComponent(username)}`, avatarUrl };
    const parsed = memberSchema.safeParse(candidate);
    if (parsed.success) members.push(parsed.data);
  }
  if (members.length === 0) throw new ParserError('empty_club_members_page');
  return members;
}
