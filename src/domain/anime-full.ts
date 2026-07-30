import type { AnimeDetail } from './anime';
import type { AnimeThemeSongs } from './anime-theme';

export interface AnimeFull extends AnimeDetail {
  themeSongs: AnimeThemeSongs;
}

export const ANIME_FULL_PARSER_VERSION = 'anime-full-html-v2';
