export interface Episode {
  number: number;
  title: string;
  titleJapanese: string | null;
  url: string;
  aired: string | null;
  score: number | null;
  forumReplies: number | null;
}

export const EPISODES_PARSER_VERSION = 'episodes-html-v2';
