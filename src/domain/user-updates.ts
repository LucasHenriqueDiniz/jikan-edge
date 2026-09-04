/**
 * The "Last Updates" feed on a MyAnimeList profile — what the user watched or read recently.
 *
 * Moved out of `user-updates.parser.ts` for the same reason as [[user-favorites]]: `UpdatesRepository`
 * and the store port name it, and a repository must not reach into the parser layer for a type.
 *
 * Not to be confused with `TitleUserUpdate` in `title-userupdates.ts`, which is the same idea seen
 * from the other end — the recent activity on a *title* rather than by a *user*.
 */
export interface UserUpdate {
  entry: { malId: number; title: string; imageUrl: string | null };
  score: number | null;
  status: string;
  progress: number | null;
  total: number | null;
  date: string;
}

export interface UserUpdates {
  anime: UserUpdate[];
  manga: UserUpdate[];
}
