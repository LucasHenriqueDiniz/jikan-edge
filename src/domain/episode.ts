export interface Episode {
  number: number;
  title: string;
  titleJapanese: string | null;
  url: string;
  aired: string | null;
  score: number | null;
  forumReplies: number | null;
  filler: boolean;
  recap: boolean;
}

// v3: Filler and Recap rows were dropped (11 of One Piece's first 100), and the list now paginates.
export const EPISODES_PARSER_VERSION = 'episodes-html-v3';
