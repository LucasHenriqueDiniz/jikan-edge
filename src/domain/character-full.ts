import type { CharacterDetail } from './character';
import type { CharacterMediaEntry } from './character-media';
import type { VoiceActor } from './voice-actor';

export interface CharacterFull extends CharacterDetail {
  anime: CharacterMediaEntry[];
  manga: CharacterMediaEntry[];
  voices: VoiceActor[];
}

export const CHARACTER_FULL_PARSER_VERSION = 'character-full-html-v2';
