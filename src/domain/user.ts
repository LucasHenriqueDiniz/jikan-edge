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
  sourceVersion: string;
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

export const PARSER_VERSION = 'user-html-v3';

export function usernameKey(username: string): string {
  return username.trim().toLowerCase();
}
