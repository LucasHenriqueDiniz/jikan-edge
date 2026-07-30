export type MediaType = 'anime' | 'manga';

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
