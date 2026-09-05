import { parseUserMediaList } from './user-list.parser';
export const parseUserAnimeList = (html: string, username: string, fetchedAt?: string) =>
  parseUserMediaList(html, username, 'anime', fetchedAt);
