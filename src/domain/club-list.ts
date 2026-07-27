export interface ClubListEntry {
  malId: number;
  title: string;
  imageUrl: string | null;
  description: string | null;
  members: number | null;
}

export const CLUB_LIST_PARSER_VERSION = 'club-list-html-v1';
