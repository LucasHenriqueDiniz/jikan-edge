export interface UserFriend {
  username: string;
  imageUrl: string | null;
  lastOnline: string | null;
  friendsSince: string | null;
}

export interface UserClub {
  malId: number;
  name: string;
  url: string;
}

export const USER_SOCIAL_PARSER_VERSION = 'user-social-html-v2';
