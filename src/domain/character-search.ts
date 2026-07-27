export interface CharacterSearchResult {
  malId: number;
  name: string;
  url: string;
  imageUrl: string | null;
}

export const CHARACTER_SEARCH_PARSER_VERSION = 'character-search-html-v1';
