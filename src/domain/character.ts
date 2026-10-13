import type { ImageSet } from './image';
export interface CharacterDetail {
  malId: number;
  url: string | null;
  name: string;
  nicknames: string[];
  nameKanji: string | null;
  imageUrl: string | null;
  images: ImageSet;
  about: string | null;
  favorites: number | null;
  fetchedAt: string;
}

// v3: `nameKanji`, `favorites` and `about` were null on every character page longer than the 60 KB
// window the parser read (5 of 6 measured on 2026-10-11), and `nicknames` moved out of `name`.
export const CHARACTER_PARSER_VERSION = 'character-html-v3';
