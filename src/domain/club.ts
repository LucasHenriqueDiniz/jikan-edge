export interface ClubStaffMember {
  username: string;
  url: string;
  role: string | null;
}

export interface ClubDetail {
  malId: number;
  url: string | null;
  title: string;
  members: number | null;
  pictures: number | null;
  category: string | null;
  created: string | null;
  staff: ClubStaffMember[];
  fetchedAt: string;
}

// v3: staff went from string[] built as "Name (Role)" — ambiguous if either contains a paren, and
// discarding the profile URL the parser already had off the same anchor — to a structured
// { username, url, role }[], matching ClubMember's shape for the same kind of data elsewhere.
export const CLUB_PARSER_VERSION = 'club-html-v3';
