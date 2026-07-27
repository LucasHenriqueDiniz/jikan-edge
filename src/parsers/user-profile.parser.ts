import { z } from 'zod';
import { PARSER_VERSION, type AnimeStatistics, type MangaStatistics, type UserProfile, type UserStatistics, usernameKey } from '../domain/user';
import { capture, numeric, ParserError } from './html';

const profileSchema = z.object({
  username: z.string().min(1).max(64),
  canonicalUsername: z.string().min(1).max(64),
  profileUrl: z.string().url(),
  avatarUrl: z.string().url().nullable(),
  about: z.string().nullable(),
  gender: z.string().nullable(),
  location: z.string().nullable(),
  birthday: z.string().nullable(),
  joinedAt: z.string().nullable(),
  lastOnlineAt: z.string().nullable(),
  fetchedAt: z.string().datetime(),
  sourceVersion: z.string(),
});

function section(html: string, marker: string, maxLength = 8_000): string {
  const index = html.indexOf(marker);
  return index === -1 ? '' : html.slice(index, index + maxLength);
}

function labelledValue(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return capture(html, new RegExp(`${escaped}<\\/span>\\s*<span[^>]*>([\\s\\S]*?)<\\/span>`, 'i'));
}

export function parseUserProfile(html: string, requestedUsername: string, fetchedAt = new Date().toISOString()): UserProfile {
  const head = html.slice(0, 30_000);
  const status = section(html, 'user-status', 12_000);
  const canonical = capture(head, /<span class="di-ib po-r">\s*([^<]+?)'s Profile\s*<\/span>/i)
    ?? capture(head, /<title>\s*([^<|]+?)(?:&#039;|'s) Profile/i)
    ?? requestedUsername;
  const profile: UserProfile = {
    username: requestedUsername,
    canonicalUsername: canonical,
    profileUrl: `https://myanimelist.net/profile/${encodeURIComponent(canonical)}`,
    avatarUrl: capture(head, /<div class="user-image[^>]*">\s*<img[^>]+(?:data-src|src)="([^"]+)"/i),
    about: capture(section(html, 'About Me', 12_000), /<div[^>]*class="[^\"]*text[^\"]*"[^>]*>([\s\S]*?)<\/div>/i),
    gender: labelledValue(status, 'Gender'),
    location: labelledValue(status, 'Location'),
    birthday: labelledValue(status, 'Birthday'),
    joinedAt: labelledValue(status, 'Joined'),
    lastOnlineAt: labelledValue(status, 'Last Online'),
    fetchedAt,
    sourceVersion: PARSER_VERSION,
  };
  const validated = profileSchema.safeParse(profile);
  if (!validated.success || usernameKey(validated.data.canonicalUsername) !== usernameKey(canonical)) throw new ParserError('invalid_profile');
  return validated.data;
}

function statusCount(html: string, label: string): number {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return numeric(capture(html, new RegExp(`${escaped}[^0-9]{0,100}([0-9,]+)`, 'i'))) ?? 0;
}

function parseAnimeBucket(html: string): AnimeStatistics {
  const data = section(html, 'Anime Stats', 8_000);
  return {
    watching: statusCount(data, 'Watching'), completed: statusCount(data, 'Completed'), onHold: statusCount(data, 'On-Hold'), dropped: statusCount(data, 'Dropped'), planToWatch: statusCount(data, 'Plan to Watch'), totalEntries: statusCount(data, 'Total Entries'),
    episodesWatched: numeric(capture(data, /Episodes Watched:\s*<\/span>\s*([\d,]+)/i)), meanScore: numeric(capture(data, /Mean Score:\s*<\/span>\s*<span[^>]*>\s*([\d.]+)/i)),
  };
}

function parseMangaBucket(html: string): MangaStatistics {
  const data = section(html, 'Manga Stats', 8_000);
  return {
    reading: statusCount(data, 'Reading'), completed: statusCount(data, 'Completed'), onHold: statusCount(data, 'On-Hold'), dropped: statusCount(data, 'Dropped'), planToRead: statusCount(data, 'Plan to Read'), totalEntries: statusCount(data, 'Total Entries'),
    chaptersRead: numeric(capture(data, /Chapters Read:\s*<\/span>\s*([\d,]+)/i)), volumesRead: numeric(capture(data, /Volumes Read:\s*<\/span>\s*([\d,]+)/i)), meanScore: numeric(capture(data, /Mean Score:\s*<\/span>\s*<span[^>]*>\s*([\d.]+)/i)),
  };
}

export function parseUserStatistics(html: string): UserStatistics {
  return { anime: parseAnimeBucket(html), manga: parseMangaBucket(html) };
}
