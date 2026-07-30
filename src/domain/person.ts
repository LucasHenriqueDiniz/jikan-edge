import type { ImageSet } from './image';
export interface PersonDetail {
  malId: number;
  url: string | null;
  name: string;
  givenName: string | null;
  familyName: string | null;
  alternateNames: string | null;
  birthday: string | null;
  website: string | null;
  imageUrl: string | null;
  images: ImageSet;
  about: string | null;
  favorites: number | null;
  fetchedAt: string;
}

export const PERSON_PARSER_VERSION = 'person-html-v2';
