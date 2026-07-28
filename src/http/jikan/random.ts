import type { AnimeDetail } from '../../domain/anime';
import type { CharacterDetail } from '../../domain/character';
import type { MangaDetail } from '../../domain/manga';
import type { PersonDetail } from '../../domain/person';
import { animeDetail } from './anime';
import { characterDetail } from './characters';
import { mangaDetail } from './manga';
import { personDetail } from './people';

/**
 * `/random/*` reads a cached payload straight out of D1, so the row is a domain object of
 * whichever kind was asked for — the kind is the only thing that tells us which mapper applies.
 */
export function randomEntity(kind: 'anime' | 'manga' | 'characters' | 'people', data: unknown) {
  switch (kind) {
    case 'anime': return animeDetail(data as AnimeDetail);
    case 'manga': return mangaDetail(data as MangaDetail);
    case 'characters': return characterDetail(data as CharacterDetail);
    case 'people': return personDetail(data as PersonDetail);
  }
}
