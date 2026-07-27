export interface TitleUserUpdate {
  username: string;
  imageUrl: string | null;
  score: number | null;
  status: string;
  progress: number | null;
  total: number | null;
  date: string;
}

export const TITLE_USERUPDATES_PARSER_VERSION = 'title-userupdates-html-v1';
