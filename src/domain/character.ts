import type { ImageSet } from './image';
export interface CharacterDetail {
  malId: number;
  url: string | null;
  name: string;
  nameKanji: string | null;
  imageUrl: string | null;
  images: ImageSet;
  about: string | null;
  favorites: number | null;
  fetchedAt: string;
}

export const CHARACTER_PARSER_VERSION = 'character-html-v2';
