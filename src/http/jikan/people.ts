import type { PersonDetail } from '../../domain/person';
import type { PersonFull } from '../../domain/person-full';
import type { PublishedManga, StaffPosition, VoiceActingRole } from '../../domain/person-media';
import type { PersonSearchResult } from '../../domain/person-search';
import type { TopPersonEntry } from '../../domain/top-person';
import { images, malUrl } from './primitives';

export function personDetail(d: PersonDetail) {
  return {
    mal_id: d.malId,
    url: malUrl('people', d.malId),
    website_url: d.website,
    images: images(d.imageUrl),
    name: d.name,
    given_name: d.givenName,
    family_name: d.familyName,
    alternate_names: d.alternateNames ? [d.alternateNames] : [],
    birthday: d.birthday,
    favorites: d.favorites,
    about: d.about,
  };
}

export function personFull(d: PersonFull) {
  return {
    ...personDetail(d),
    anime: personAnime(d.anime),
    manga: personManga(d.manga),
    voices: personVoices(d.voices),
  };
}

export function personAnime(rows: StaffPosition[]) {
  return rows.map((row) => ({
    position: row.positions.join(', '),
    positions: row.positions,
    anime: { mal_id: row.animeId, url: malUrl('anime', row.animeId), images: images(row.imageUrl), title: row.animeTitle },
  }));
}

export function personManga(rows: PublishedManga[]) {
  return rows.map((row) => ({
    position: row.positions.join(', '),
    positions: row.positions,
    manga: { mal_id: row.mangaId, url: malUrl('manga', row.mangaId), images: images(row.imageUrl), title: row.mangaTitle },
  }));
}

export function personVoices(rows: VoiceActingRole[]) {
  return rows.map((row) => ({
    role: row.characterRole,
    anime: { mal_id: row.animeId, url: malUrl('anime', row.animeId), images: images(row.animeImageUrl), title: row.animeTitle },
    character: { mal_id: row.characterId, url: malUrl('character', row.characterId), images: images(row.characterImageUrl), name: row.characterName },
  }));
}

export function personSearch(rows: PersonSearchResult[]) {
  return rows.map((row) => ({
    mal_id: row.malId,
    url: row.url,
    images: images(row.imageUrl),
    name: row.name,
    alternate_names: [],
  }));
}

export function topPeople(rows: TopPersonEntry[]) {
  return rows.map((row) => ({
    mal_id: row.malId,
    url: malUrl('people', row.malId),
    images: images(row.imageUrl),
    name: row.name,
    family_name: row.nameKanji,
    alternate_names: [],
    birthday: row.birthday,
    favorites: row.favorites,
  }));
}
