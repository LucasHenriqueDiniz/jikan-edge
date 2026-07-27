import { CHARACTER_FULL_PARSER_VERSION, type CharacterFull } from '../domain/character-full';
import { parseCharacterDetail } from './character-detail.parser';
import { parseCharacterAnimeography, parseCharacterMangaography, parseCharacterVoiceActors } from './character-media.parser';

// Every sub-field here already has its own tested parser (used by the standalone
// anime/manga/voices routes) — full() just combines one fetch of the same detail page into a
// single payload instead of doing the same combination client-side across four requests.
export function parseCharacterFull(html: string, malId: number, fetchedAt = new Date().toISOString()): CharacterFull {
  const detail = parseCharacterDetail(html, malId, fetchedAt);
  return {
    ...detail,
    anime: parseCharacterAnimeography(html),
    manga: parseCharacterMangaography(html),
    voices: parseCharacterVoiceActors(html),
    sourceVersion: CHARACTER_FULL_PARSER_VERSION,
  };
}
