export interface ClubDetail {
  malId: number;
  url: string | null;
  title: string;
  members: number | null;
  pictures: number | null;
  category: string | null;
  created: string | null;
  staff: string[];
  fetchedAt: string;
}

export const CLUB_PARSER_VERSION = 'club-html-v2';
