export interface PersonSearchResult {
  malId: number;
  name: string;
  url: string;
  imageUrl: string | null;
}

export const PERSON_SEARCH_PARSER_VERSION = 'person-search-html-v1';
