import type { CharacterDetail } from '../../domain/character';
import type { CharacterFull } from '../../domain/character-full';
import type { CharacterMediaEntry } from '../../domain/character-media';
import type { CharacterSearchResult } from '../../domain/character-search';
import type { CharacterRole, StaffMember } from '../../domain/characters-staff';
import type { TopCharacterEntry } from '../../domain/top-character';
import type { VoiceActor } from '../../domain/voice-actor';
import { entity, images, malUrl } from './primitives';

export function characterDetail(d: CharacterDetail) {
  return {
    mal_id: d.malId,
    url: malUrl('character', d.malId),
    images: images(d.imageUrl),
    name: d.name,
    name_kanji: d.nameKanji,
    nicknames: [],
    favorites: d.favorites,
    about: d.about,
  };
}

export function characterFull(d: CharacterFull) {
  return {
    ...characterDetail(d),
    anime: characterMedia(d.anime, 'anime'),
    manga: characterMedia(d.manga, 'manga'),
    voices: voiceActors(d.voices),
  };
}

/** Jikan nests the work under `anime`/`manga` and keeps the character's role beside it. */
export function characterMedia(rows: CharacterMediaEntry[], type: 'anime' | 'manga') {
  return rows.map((row) => ({
    role: row.role,
    [type]: { mal_id: row.malId, url: malUrl(type, row.malId), images: images(row.imageUrl), title: row.title },
  }));
}

export function voiceActors(rows: VoiceActor[]) {
  return rows.map((row) => ({
    language: row.language,
    person: { mal_id: row.malId, url: malUrl('people', row.malId), images: images(row.imageUrl), name: row.name },
  }));
}

export function characterSearch(rows: CharacterSearchResult[]) {
  return rows.map((row) => ({
    mal_id: row.malId,
    url: row.url,
    images: images(row.imageUrl),
    name: row.name,
    nicknames: [],
  }));
}

export function topCharacters(rows: TopCharacterEntry[]) {
  return rows.map((row) => ({
    mal_id: row.malId,
    url: malUrl('character', row.malId),
    images: images(row.imageUrl),
    name: row.name,
    name_kanji: row.nameKanji,
    nicknames: [],
    favorites: row.favorites,
    animeography: row.animeography.map((work) => entity('anime', work.malId, work.title)),
    mangaography: row.mangaography.map((work) => entity('manga', work.malId, work.title)),
  }));
}

/** `/anime/:id/characters` — the cast list, with each role's voice actors attached. */
export function characterRoles(rows: CharacterRole[]) {
  return rows.map((row) => ({
    character: { mal_id: row.malId, url: malUrl('character', row.malId), images: images(row.imageUrl), name: row.name },
    role: row.role,
    favorites: row.favorites,
    voice_actors: row.voiceActors.map((va) => ({
      person: { mal_id: va.malId, url: malUrl('people', va.malId), images: images(va.imageUrl), name: va.name },
      language: va.language,
    })),
  }));
}

export function staff(rows: StaffMember[]) {
  return rows.map((row) => ({
    person: { mal_id: row.malId, url: malUrl('people', row.malId), images: images(row.imageUrl), name: row.name },
    positions: row.role ? [row.role] : [],
  }));
}
