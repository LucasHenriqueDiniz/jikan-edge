import { PERSON_FULL_PARSER_VERSION, type PersonFull } from '../domain/person-full';
import { parsePersonDetail } from './person-detail.parser';
import { parsePersonAnimeStaff, parsePersonManga, parsePersonVoiceActingRoles } from './person-media.parser';

// Same rationale as character-full.parser.ts: every sub-field already has its own tested
// parser (the standalone anime/manga/voices routes) — full() just bundles one fetch of the
// same detail page into a single payload.
export function parsePersonFull(html: string, malId: number, fetchedAt = new Date().toISOString()): PersonFull {
  const detail = parsePersonDetail(html, malId, fetchedAt);
  return {
    ...detail,
    anime: parsePersonAnimeStaff(html),
    manga: parsePersonManga(html),
    voices: parsePersonVoiceActingRoles(html),
    sourceVersion: PERSON_FULL_PARSER_VERSION,
  };
}
