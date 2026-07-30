import { z } from 'zod';
import type { UserSearchResult } from '../domain/user-search';
import { decodeHtml, imageFrom, ParserError } from './html';
import { parseUserProfile } from './user-profile.parser';

const entrySchema = z.object({
  username: z.string().min(1).max(64),
  url: z.string().url(),
  avatarUrl: z.string().url().nullable(),
  joinedAt: z.string().nullable(),
});

const RESULT_MARKER = '<td align="center"  class="borderClass">';

/**
 * An exact-username query makes MAL redirect straight to the profile page (303) instead of
 * rendering a results list — MalClient follows that redirect transparently, so this parser has
 * to recognize both shapes: a real "User Search Results" list, or a single profile page.
 */
export function parseUserSearch(html: string, requestedQuery: string, fetchedAt = new Date().toISOString()): UserSearchResult[] {
  if (html.includes('User Search Results')) {
    const results: UserSearchResult[] = [];
    for (const block of html.split(RESULT_MARKER).slice(1)) {
      const username = decodeHtml(block.match(/<a href="\/profile\/([^"]+)">/i)?.[1] ?? '');
      if (!username) continue;
      const avatarUrl = imageFrom(block);
      const joinedAt = decodeHtml(block.match(/class="spaceit_pad lightLink"><small>([^<]+)<\/small>/i)?.[1] ?? '') || null;
      const candidate = { username, url: `https://myanimelist.net/profile/${username}`, avatarUrl, joinedAt };
      const parsed = entrySchema.safeParse(candidate);
      if (parsed.success) results.push(parsed.data);
    }
    if (results.length === 0) throw new ParserError('empty_user_search_page');
    return results;
  }

  try {
    const profile = parseUserProfile(html, requestedQuery, fetchedAt);
    return [{ username: profile.canonicalUsername, url: profile.profileUrl, avatarUrl: profile.avatarUrl, joinedAt: profile.joinedAt }];
  } catch {
    throw new ParserError('unrecognized_user_search_page');
  }
}
