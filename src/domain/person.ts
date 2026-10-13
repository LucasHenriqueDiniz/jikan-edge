import type { ImageSet } from './image';
export interface PersonDetail {
  malId: number;
  url: string | null;
  name: string;
  givenName: string | null;
  familyName: string | null;
  alternateNames: string[];
  // MAL's own text, which is often a month and day with no year (`Sep 8`): kept as printed, because
  // a date field would have to drop exactly those.
  birthday: string | null;
  // The same day as `YYYY-MM-DD`, only when MAL prints all three parts.
  birthDate: string | null;
  website: string | null;
  imageUrl: string | null;
  images: ImageSet;
  about: string | null;
  favorites: number | null;
  fetchedAt: string;
}

// v3: `alternateNames` is a list instead of one comma-joined string, `birthDate` is new, and `about`
// no longer gets a space where an inline link was (`@ seki0908`).
export const PERSON_PARSER_VERSION = 'person-html-v3';
