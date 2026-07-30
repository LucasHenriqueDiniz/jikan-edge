export interface CharacterDetail {
  malId: number;
  name: string;
  nameKanji: string | null;
  imageUrl: string | null;
  about: string | null;
  favorites: number | null;
  fetchedAt: string;
}

export const CHARACTER_PARSER_VERSION = 'character-html-v1';
