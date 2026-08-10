import { z } from 'zod';
import type { ClubDetail, ClubStaffMember } from '../domain/club';
import { canonicalUrl, capture, decodeHtml, labelValue, numeric, ParserError } from './html';

const staffMemberSchema = z.object({ username: z.string().min(1), url: z.string().url(), role: z.string().nullable() });
const clubDetailSchema = z.object({
  malId: z.number().int().positive(),
  url: z.string().url().nullable(),
  title: z.string().min(1),
  members: z.number().nullable(),
  pictures: z.number().nullable(),
  category: z.string().nullable(),
  created: z.string().nullable(),
  staff: z.array(staffMemberSchema),
  fetchedAt: z.string().datetime(),
});

// Mirrors club-members.parser.ts: username is the anchor's own text (MAL usernames are already
// URL-safe), not a slug reconstructed from a display name — the mistake genre-taxonomy/producers-
// list/magazines parsers made elsewhere by rebuilding a slug instead of trusting the one already
// captured in the href.
function extractStaff(html: string): ClubStaffMember[] {
  const start = html.indexOf('Club Staff');
  const end = html.indexOf('Club Type', start);
  if (start === -1) return [];
  const block = html.slice(start, end === -1 ? start + 3_000 : end);
  return [...block.matchAll(/<a href="\/profile\/[^"]+">([^<]+)<\/a>\s*\(([^)]+)\)/gi)].map((match) => {
    const username = decodeHtml(match[1]);
    return { username, url: `https://myanimelist.net/profile/${encodeURIComponent(username)}`, role: decodeHtml(match[2]) || null };
  });
}

export function parseClubDetail(html: string, malId: number, fetchedAt = new Date().toISOString()): ClubDetail {
  const statsStart = html.indexOf('Club Stats');
  const stats = statsStart === -1 ? '' : html.slice(statsStart, statsStart + 2_000);
  const detail: ClubDetail = {
    malId,
    // A club page carries no <link rel="canonical"> — only og:url, in the `clubs.php?cid=` form.
    url: canonicalUrl(html.slice(0, 60_000)),
    title: capture(html.slice(0, 60_000), /<h1 class="h1">([^<]+)<\/h1>/i) ?? '',
    members: numeric(labelValue(stats, 'Members')),
    pictures: numeric(labelValue(stats, 'Pictures')),
    category: labelValue(stats, 'Category'),
    created: labelValue(stats, 'Created'),
    staff: extractStaff(html),
    fetchedAt,
  };
  const validated = clubDetailSchema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_club_detail');
  return validated.data;
}
