export interface EpisodeDetail {
  malId: number;
  episode: number;
  title: string | null;
  titleAlternative: string | null;
  duration: string | null;
  aired: string | null;
  synopsis: string | null;
}

export const EPISODE_DETAIL_PARSER_VERSION = 'episode-detail-html-v2';
