import { z } from 'zod';
import { CLUB_PARSER_VERSION, type ClubDetail } from '../domain/club';
import { capture, decodeHtml, numeric, ParserError } from './html';

const clubDetailSchema = z.object({
  malId: z.number().int().positive(),
  title: z.string().min(1),
  members: z.number().nullable(),
  pictures: z.number().nullable(),
  category: z.string().nullable(),
  created: z.string().nullable(),
  staff: z.array(z.string()),
  fetchedAt: z.string().datetime(),
  sourceVersion: z.string(),
});

function plainLabelValue(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return capture(html, new RegExp(`${escaped}:<\\/span>([\\s\\S]*?)<\\/div>`, 'i'));
}

function extractStaff(html: string): string[] {
  const start = html.indexOf('Club Staff');
  const end = html.indexOf('Club Type', start);
  if (start === -1) return [];
  const block = html.slice(start, end === -1 ? start + 3_000 : end);
  return [...block.matchAll(/<a href="\/profile\/[^"]+">([^<]+)<\/a>\s*\(([^)]+)\)/gi)].map((match) => `${decodeHtml(match[1])} (${decodeHtml(match[2])})`);
}

export function parseClubDetail(html: string, malId: number, fetchedAt = new Date().toISOString()): ClubDetail {
  const statsStart = html.indexOf('Club Stats');
  const stats = statsStart === -1 ? '' : html.slice(statsStart, statsStart + 2_000);
  const detail: ClubDetail = {
    malId,
    title: capture(html.slice(0, 60_000), /<h1 class="h1">([^<]+)<\/h1>/i) ?? '',
    members: numeric(plainLabelValue(stats, 'Members')),
    pictures: numeric(plainLabelValue(stats, 'Pictures')),
    category: plainLabelValue(stats, 'Category'),
    created: plainLabelValue(stats, 'Created'),
    staff: extractStaff(html),
    fetchedAt,
    sourceVersion: CLUB_PARSER_VERSION,
  };
  const validated = clubDetailSchema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_club_detail');
  return validated.data;
}
