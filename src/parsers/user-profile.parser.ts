import { z } from 'zod';
import { type AnimeStatistics, type MangaStatistics, type UserProfile, type UserStatistics, usernameKey } from '../domain/user';
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
  };
  const validated = profileSchema.safeParse(profile);
  if (!validated.success || usernameKey(validated.data.canonicalUsername) !== usernameKey(canonical)) throw new ParserError('invalid_profile');
  return validated.data;
}

// The profile renders Anime Stats and then Manga Stats. The two headings sit ~2 KB apart — well inside the
// 8 KB window this used to take — so an anime bucket missing a label silently fell through to the manga
// number below it. Cut the anime bucket at the next heading instead.
function statsSection(html: string, marker: 'Anime Stats' | 'Manga Stats'): string {
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const rest = html.slice(start);
  const boundary = marker === 'Anime Stats' ? rest.indexOf('Manga Stats', marker.length) : -1;
  return boundary === -1 ? rest.slice(0, 12_000) : rest.slice(0, boundary);
}

// Each bucket holds two lists (`stats-status`, `stats-data`) followed by the "Last * Updates" feed, which
// repeats the same status words. Narrowing to the right `<ul>` keeps generic labels — "Completed",
// "Episodes" — from reaching that feed.
function statsList(section: string, className: 'stats-status' | 'stats-data'): string {
  const start = section.indexOf(className);
  if (start === -1) return '';
  const end = section.indexOf('</ul>', start);
  return end === -1 ? section.slice(start) : section.slice(start, end);
}

// Status counts live in `<a class="... circle anime watching">Watching</a><span ...>1</span>`;
// anchoring on `>Label</a>` avoids the class names, graph pixel widths and `lh10` digits nearby.
function statusCount(html: string, label: string): number {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return numeric(capture(html, new RegExp(`>${escaped}<\\/a>\\s*<span[^>]*>\\s*([\\d,]+)`, 'i'))) ?? 0;
}

// Totals live in `<span class="...">Label</span><span class="...">1,234</span>` (labels are
// "Total Entries", "Episodes", "Chapters", "Volumes" — not "Episodes Watched"/"Chapters Read").
function dataValue(html: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return numeric(capture(html, new RegExp(`>${escaped}<\\/span>\\s*<span[^>]*>\\s*([\\d,]+)`, 'i')));
}

// Unlike every other stat, the "Days" value sits *outside* a span (`<span ...>Days: </span>12.5`),
// so neither `dataValue` nor the `Mean Score:` pattern (whose value is wrapped in `<span
// class="score-label">`) reaches it — hence a third shape. Fractional, so `[\d.,]` not `[\d,]`.
function daysValue(html: string): number | null {
  return numeric(capture(html, /Days:\s*<\/span>\s*([\d.,]+)/i));
}

function meanScore(html: string): number | null {
  return numeric(capture(html, /Mean Score:\s*<\/span>\s*<span[^>]*>\s*([\d.]+)/i));
}

function parseAnimeBucket(html: string): AnimeStatistics {
  const data = statsSection(html, 'Anime Stats');
  const status = statsList(data, 'stats-status'); const totals = statsList(data, 'stats-data');
  return {
    watching: statusCount(status, 'Watching'), completed: statusCount(status, 'Completed'), onHold: statusCount(status, 'On-Hold'), dropped: statusCount(status, 'Dropped'), planToWatch: statusCount(status, 'Plan to Watch'), totalEntries: dataValue(totals, 'Total Entries') ?? 0,
    rewatched: dataValue(totals, 'Rewatched'), episodesWatched: dataValue(totals, 'Episodes'), daysWatched: daysValue(data), meanScore: meanScore(data),
  };
}

function parseMangaBucket(html: string): MangaStatistics {
  const data = statsSection(html, 'Manga Stats');
  const status = statsList(data, 'stats-status'); const totals = statsList(data, 'stats-data');
  return {
    reading: statusCount(status, 'Reading'), completed: statusCount(status, 'Completed'), onHold: statusCount(status, 'On-Hold'), dropped: statusCount(status, 'Dropped'), planToRead: statusCount(status, 'Plan to Read'), totalEntries: dataValue(totals, 'Total Entries') ?? 0,
    reread: dataValue(totals, 'Reread'), chaptersRead: dataValue(totals, 'Chapters'), volumesRead: dataValue(totals, 'Volumes'), daysRead: daysValue(data), meanScore: meanScore(data),
  };
}

export function parseUserStatistics(html: string): UserStatistics {
  return { anime: parseAnimeBucket(html), manga: parseMangaBucket(html) };
}
