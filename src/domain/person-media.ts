export interface StaffPosition {
  animeId: number;
  animeTitle: string;
  imageUrl: string | null;
  positions: string[];
}

export interface PublishedManga {
  mangaId: number;
  mangaTitle: string;
  imageUrl: string | null;
  positions: string[];
}

export interface VoiceActingRole {
  animeId: number;
  animeTitle: string;
  animeImageUrl: string | null;
  characterId: number;
  characterName: string;
  characterRole: string | null;
  characterImageUrl: string | null;
}

export const PERSON_MEDIA_PARSER_VERSION = 'person-media-html-v1';
