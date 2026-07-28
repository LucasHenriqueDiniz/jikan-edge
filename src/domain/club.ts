export interface ClubStaffMember {
  username: string;
  url: string;
  role: string | null;
}

export interface ClubDetail {
  malId: number;
  title: string;
  members: number | null;
  pictures: number | null;
  category: string | null;
  created: string | null;
  staff: ClubStaffMember[];
  fetchedAt: string;
  sourceVersion: string;
}

// v2: staff is structured ({username, url, role}) instead of a "name (role)" string.
export const CLUB_PARSER_VERSION = 'club-html-v2';
