import type { MangaDetail, MangaListEntry } from '../../domain/manga';
import { daterange, entities, images, malUrl, relations, titles } from './primitives';

export function mangaDetail(d: MangaDetail) {
  return {
    mal_id: d.malId,
    url: malUrl('manga', d.malId),
    images: images(d.imageUrl),
    approved: null,
    titles: titles(d),
    title: d.title,
    title_english: d.titleEnglish,
    title_japanese: d.titleJapanese,
    title_synonyms: [],
    type: d.type,
    chapters: d.chapters,
    volumes: d.volumes,
    status: d.status,
    publishing: d.status === 'Publishing',
    published: daterange(d.published),
    score: d.score,
    scored: d.score,
    scored_by: null,
    rank: d.rank,
    popularity: d.popularity,
    members: d.members,
    favorites: d.favorites,
    synopsis: d.synopsis,
    background: null,
    authors: entities('people', d.authors),
    // MAL renders serialization as a single magazine name without a usable id on the detail
    // page, so this stays a bare name rather than a half-filled entity ref.
    serializations: d.serialization ? [{ mal_id: 0, type: 'manga', name: d.serialization, url: '' }] : [],
    genres: entities('manga', d.genres),
    explicit_genres: [],
    themes: entities('manga', d.themes),
    demographics: entities('manga', d.demographics),
    relations: relations(d.relations),
    external: d.externalLinks,
  };
}

/** `full` adds nothing real for manga — the detail already carries relations and external links. */
export function mangaFull(d: MangaDetail) {
  return mangaDetail(d);
}

export function mangaListEntry(e: MangaListEntry) {
  return {
    mal_id: e.malId,
    url: malUrl('manga', e.malId),
    images: images(e.imageUrl),
    title: e.title,
    titles: titles(e),
    type: e.type,
    volumes: e.volumes,
    score: e.score,
    members: e.members,
    published: daterange(e.startDate),
  };
}

export function mangaList(entries: MangaListEntry[]) {
  return entries.map(mangaListEntry);
}
