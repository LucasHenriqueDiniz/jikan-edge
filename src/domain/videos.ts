export interface EpisodeVideoEntry {
  episode: number;
  title: string | null;
  url: string;
  imageUrl: string | null;
}

export interface PromoVideoEntry {
  title: string;
  videoUrl: string | null;
  imageUrl: string | null;
}

export interface TitleVideos {
  promos: PromoVideoEntry[];
  musicVideos: PromoVideoEntry[];
  episodes: EpisodeVideoEntry[];
}

export const VIDEOS_PARSER_VERSION = 'videos-html-v2';
