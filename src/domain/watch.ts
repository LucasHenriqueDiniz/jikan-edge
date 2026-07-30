export interface WatchEpisodeEntry {
  animeId: number;
  animeTitle: string;
  imageUrl: string | null;
  episodes: string[];
}

export interface WatchPromoEntry {
  animeId: number;
  animeTitle: string;
  imageUrl: string | null;
  title: string;
  videoUrl: string | null;
}

export const WATCH_PARSER_VERSION = 'watch-html-v2';
