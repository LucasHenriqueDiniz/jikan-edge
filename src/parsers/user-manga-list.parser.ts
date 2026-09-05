import { parseUserMediaList } from './user-list.parser';
export const parseUserMangaList = (html: string, username: string, fetchedAt?: string) =>
  parseUserMediaList(html, username, 'manga', fetchedAt);
