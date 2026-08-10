import type { AnimeDetail } from './anime';
import type { AnimeThemeSongs } from './anime-theme';

export interface AnimeFull extends AnimeDetail {
  themeSongs: AnimeThemeSongs;
}

// v3: extractSongs recognizes MAL's newer theme-song widget (plain quoted text after
// theme-song-index instead of a nested theme-song-title span). Rows already cached under v2 may be
// silently missing songs the source page actually has — bumped so they refetch instead of keeping
// stale, incomplete themeSongs indefinitely.
export const ANIME_FULL_PARSER_VERSION = 'anime-full-html-v3';
