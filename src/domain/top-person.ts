export interface TopPersonEntry {
  malId: number;
  name: string;
  nameKanji: string | null;
  imageUrl: string | null;
  birthday: string | null;
  favorites: number | null;
}

export const TOP_PEOPLE_PARSER_VERSION = 'top-people-html-v1';
