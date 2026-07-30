export interface VoiceActor {
  malId: number;
  name: string;
  language: string | null;
  imageUrl: string | null;
}

export interface CharacterRole {
  malId: number;
  name: string;
  imageUrl: string | null;
  role: string | null;
  favorites: number | null;
  voiceActors: VoiceActor[];
}

export interface StaffMember {
  malId: number;
  name: string;
  imageUrl: string | null;
  role: string | null;
}

export const CHARACTERS_STAFF_PARSER_VERSION = 'characters-staff-html-v2';
