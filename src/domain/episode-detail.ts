export interface EpisodeDetail {
  malId: number;
  episode: number;
  title: string | null;
  titleAlternative: string | null;
  duration: string | null;
  aired: string | null;
  synopsis: string | null;
}

// v3: an episode MAL has no page for used to be cached as a 200 with every field null; it is a 404
// now, and the bump stops those rows being served for the rest of their TTL.
export const EPISODE_DETAIL_PARSER_VERSION = 'episode-detail-html-v3';
