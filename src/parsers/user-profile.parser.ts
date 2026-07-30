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

/**
 * The profile page renders Anime Stats and then Manga Stats. Bound each bucket at the next heading so
 * one media type can never fall through to the other's numbers when a label is missing.
 */
function statsSection(html: string, marker: 'Anime Stats' | 'Manga Stats'): string {
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const rest = html.slice(start);
  const boundary = marker === 'Anime Stats' ? rest.indexOf('Manga Stats', marker.length) : -1;
  return (boundary === -1 ? rest : rest.slice(0, boundary)).slice(0, 12_000);
}

/** Narrows a bucket to one of its two `<ul>`s, so generic labels ("Completed", "Episodes") cannot match the update feed below. */
function statsList(section: string, className: 'stats-status' | 'stats-data'): string {
  const start = section.indexOf(className);
  if (start === -1) return '';
  const end = section.indexOf('</ul>', start);
  return end === -1 ? section.slice(start) : section.slice(start, end);
}

/**
 * Reads one list row, where the label closes its own tag and the count is the entire text of the next span:
 *   <a ... class="... anime completed">Completed</a><span class="di-ib fl-r lh10">233</span>
 *   <span class="di-ib fl-l fn-grey2">Episodes</span><span class="di-ib fl-r">8,481</span>
 * Anchoring on the closing tag keeps attribute noise out of the capture — a looser pattern reads the graph
 * bar's `style="width: 221.9px"` or the `lh10` utility class as if it were the count.
 */
function rowValue(html: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return numeric(capture(html, new RegExp(`>\\s*${escaped}\\s*<\\/(?:a|span)>\\s*<span[^>]*>\\s*([\\d,]+)\\s*<`, 'i')));
}

/** `<span class="fn-grey2 fw-n">Days: </span>142.3` — a decimal that sits outside any tag. */
function daysValue(html: string): number | null {
  return numeric(capture(html, /Days:\s*<\/span>\s*([\d,]+(?:\.\d+)?)/i));
}

/** Null when the profile has no scored entries, where MAL renders `N/A` in place of the number. */
function meanScoreValue(html: string): number | null {
  return numeric(capture(html, /Mean Score:\s*<\/span>\s*<span[^>]*>\s*([\d.]+)/i));
}

function parseAnimeBucket(html: string): AnimeStatistics {
  const data = statsSection(html, 'Anime Stats');
  const status = statsList(data, 'stats-status');
  const totals = statsList(data, 'stats-data');
  return {
    watching: rowValue(status, 'Watching') ?? 0, completed: rowValue(status, 'Completed') ?? 0, onHold: rowValue(status, 'On-Hold') ?? 0, dropped: rowValue(status, 'Dropped') ?? 0, planToWatch: rowValue(status, 'Plan to Watch') ?? 0, totalEntries: rowValue(totals, 'Total Entries') ?? 0,
    rewatched: rowValue(totals, 'Rewatched'), episodesWatched: rowValue(totals, 'Episodes'), daysWatched: daysValue(data), meanScore: meanScoreValue(data),
  };
}

function parseMangaBucket(html: string): MangaStatistics {
  const data = statsSection(html, 'Manga Stats');
  const status = statsList(data, 'stats-status');
  const totals = statsList(data, 'stats-data');
  return {
    reading: rowValue(status, 'Reading') ?? 0, completed: rowValue(status, 'Completed') ?? 0, onHold: rowValue(status, 'On-Hold') ?? 0, dropped: rowValue(status, 'Dropped') ?? 0, planToRead: rowValue(status, 'Plan to Read') ?? 0, totalEntries: rowValue(totals, 'Total Entries') ?? 0,
    reread: rowValue(totals, 'Reread'), chaptersRead: rowValue(totals, 'Chapters'), volumesRead: rowValue(totals, 'Volumes'), daysRead: daysValue(data), meanScore: meanScoreValue(data),
  };
}

export function parseUserStatistics(html: string): UserStatistics {
  return { anime: parseAnimeBucket(html), manga: parseMangaBucket(html) };
}
