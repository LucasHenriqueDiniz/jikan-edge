export interface CharacterMediaEntry {
  malId: number;
  title: string;
  imageUrl: string | null;
  role: string | null;
}

export const CHARACTER_MEDIA_PARSER_VERSION = 'character-media-html-v1';
