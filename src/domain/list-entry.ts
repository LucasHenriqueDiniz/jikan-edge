export type MediaType = 'anime' | 'manga';

/** Kept separate from the profile's `PARSER_VERSION` so a list-parser change does not force every cached
 *  profile and statistics row to refetch as collateral. */
export const LIST_PARSER_VERSION = 'user-list-html-v2';

export interface UserMediaListEntry {
  username: string;
  mediaType: MediaType;
  malId: number;
  title: string;
  imageUrl: string | null;
  status: string | null;
  score: number | null;
  progress: number | null;
  total: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string | null;
  fetchedAt: string;
}
