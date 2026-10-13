import type { PersonDetail } from './person';
import type { PublishedManga, StaffPosition, VoiceActingRole } from './person-media';

export interface PersonFull extends PersonDetail {
  anime: StaffPosition[];
  manga: PublishedManga[];
  voices: VoiceActingRole[];
}

// v3: carries the person-html-v3 detail fields (see PERSON_PARSER_VERSION).
export const PERSON_FULL_PARSER_VERSION = 'person-full-html-v3';
