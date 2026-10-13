// MAL's seven reaction buttons, in the order of their `data-val` (1 nice … 7 creative). The page
// carries the counts as `data-reactions='{"num":6056,"count":["5622","201",…]}'`, where `count[i]`
// belongs to the button whose `data-val` is `i + 1` and `num` is the total.
export interface ReviewReactions {
  overall: number;
  nice: number;
  loveIt: number;
  funny: number;
  confusing: number;
  informative: number;
  wellWritten: number;
  creative: number;
}

// What every review card says about itself, on the global feed, a title's page and a profile alike.
// `episodesWatched` / `chaptersRead` come from the Preliminary tag — `Preliminary (344/? eps)` — which
// is the only place MAL prints how far the reviewer had got, so a finished review has neither.
export interface ReviewMarkers {
  reviewId: number | null;
  url: string | null;
  isPreliminary: boolean;
  isSpoiler: boolean;
  episodesWatched: number | null;
  chaptersRead: number | null;
  reactions: ReviewReactions | null;
}

export interface ReviewEntry extends ReviewMarkers {
  malId: number;
  title: string;
  imageUrl: string | null;
  username: string | null;
  date: string | null;
  tag: string | null;
  score: number | null;
  reviewText: string | null;
}

// v3: review id, url, the preliminary/spoiler flags and the reactions.
export const REVIEW_PARSER_VERSION = 'review-html-v3';
