import { z } from 'zod';
import type { UserClub } from '../domain/user-social';
import { decodeHtml } from './html';

const clubSchema = z.object({ malId: z.number().int().positive(), name: z.string().min(1), url: z.string().url() });

export function parseUserClubs(html: string): UserClub[] {
  const clubs: UserClub[] = [];
  const seen = new Set<number>();
  for (const match of html.matchAll(/<a href="\/clubs\.php\?cid=(\d+)">([^<]+)<\/a>/gi)) {
    const malId = Number(match[1]);
    if (seen.has(malId)) continue;
    seen.add(malId);
    const candidate = { malId, name: decodeHtml(match[2]), url: `https://myanimelist.net/clubs.php?cid=${malId}` };
    const parsed = clubSchema.safeParse(candidate);
    if (parsed.success) clubs.push(parsed.data);
  }
  return clubs;
}
