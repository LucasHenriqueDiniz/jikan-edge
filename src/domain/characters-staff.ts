import type { VoiceActor } from './voice-actor';

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

// v3: parseStaff no longer cuts the Staff section at a fixed 80 KB — a large production's staff
// table can run well past that (One Piece measured at 543 KB live) with silent truncation and no
// error. Bumped so anime/manga already cached under v2 refetch instead of keeping an incomplete
// staff list indefinitely.
export const CHARACTERS_STAFF_PARSER_VERSION = 'characters-staff-html-v3';
