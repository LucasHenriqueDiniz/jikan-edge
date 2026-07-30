export interface TopCharacterWorkRef {
  malId: number;
  title: string;
}

export interface TopCharacterEntry {
  malId: number;
  name: string;
  nameKanji: string | null;
  imageUrl: string | null;
  animeography: TopCharacterWorkRef[];
  mangaography: TopCharacterWorkRef[];
  favorites: number | null;
}

export const TOP_CHARACTERS_PARSER_VERSION = 'top-characters-html-v2';
