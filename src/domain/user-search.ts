export interface UserSearchResult {
  username: string;
  url: string;
  avatarUrl: string | null;
  joinedAt: string | null;
}

export const USER_SEARCH_PARSER_VERSION = 'user-search-html-v2';
