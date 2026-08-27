export interface UserProfile {
  username: string;
  canonicalUsername: string;
  profileUrl: string;
  avatarUrl: string | null;
  about: string | null;
  gender: string | null;
  location: string | null;
  birthday: string | null;
  joinedAt: string | null;
  lastOnlineAt: string | null;
  fetchedAt: string;
}

export interface AnimeStatistics {
  watching: number;
  completed: number;
  onHold: number;
  dropped: number;
  planToWatch: number;
  totalEntries: number;
  rewatched: number | null;
  episodesWatched: number | null;
  daysWatched: number | null;
  meanScore: number | null;
}

export interface MangaStatistics {
  reading: number;
  completed: number;
  onHold: number;
  dropped: number;
  planToRead: number;
  totalEntries: number;
  reread: number | null;
  chaptersRead: number | null;
  volumesRead: number | null;
  daysRead: number | null;
  meanScore: number | null;
}

export interface UserStatistics {
  anime: AnimeStatistics;
  manga: MangaStatistics;
}

// v5: avatarUrl and about now resolve on real profiles. Both were structurally null — the avatar
// because it sits past the 30,000-char prefix the parser searched, the About because its lookup
// anchored on a string ("About Me") that does not exist on the page. The bump is required, not
// cosmetic: every profile cached under v4 holds `null` for both, and those rows would otherwise
// serve the missing fields until their 6 h TTL expired.
export const PARSER_VERSION = 'user-html-v5';

export function usernameKey(username: string): string {
  return username.trim().toLowerCase();
}
