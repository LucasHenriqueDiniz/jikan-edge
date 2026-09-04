import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyD1Migrations, env } from 'cloudflare:test';
import { AnimeRepository } from '../../src/repositories/anime.repository';
import { MangaRepository } from '../../src/repositories/manga.repository';
import { CharacterRepository } from '../../src/repositories/character.repository';
import { ProducerRepository } from '../../src/repositories/producer.repository';
import { ClubRepository } from '../../src/repositories/club.repository';
import { PersonRepository } from '../../src/repositories/person.repository';
import { CatalogListRepository } from '../../src/repositories/catalog-list.repository';
import { RandomService } from '../../src/services/random.service';
import type { AnimeDetail } from '../../src/domain/anime';
import type { MangaDetail } from '../../src/domain/manga';
import type { CharacterDetail } from '../../src/domain/character';
import type { ProducerDetail } from '../../src/domain/producer';
import type { ClubDetail } from '../../src/domain/club';
import type { PersonDetail } from '../../src/domain/person';
import type { GenreTaxonomyEntry } from '../../src/domain/genre';

const bindings = env as unknown as { DB: D1Database; TEST_MIGRATIONS: import('cloudflare:test').D1Migration[] };
const fetchedAt = '2026-07-19T00:00:00.000Z';

function detail(malId: number): AnimeDetail {
  return {
    malId,
    url: null,
    title: `Anime ${malId}`,
    titleEnglish: null,
    titleJapanese: null,
    titleSynonyms: [],
    imageUrl: null,
    images: { small: null, medium: null, large: null },
    trailer: { youtubeId: null, url: null, embedUrl: null },
    synopsis: null,
    background: null,
    type: 'TV',
    episodes: 26,
    status: 'Finished Airing',
    airing: false,
    aired: { from: null, to: null, string: null },
    season: null,
    year: null,
    broadcast: { day: null, time: null, timezone: null, string: null },
    studios: [],
    producers: [],
    licensors: [],
    genres: [],
    themes: [],
    demographics: [],
    duration: null,
    rating: null,
    score: 8.5,
    scoredBy: null,
    rank: 1,
    popularity: 1,
    members: 100,
    favorites: 10,
    source: null,
    relations: [],
    externalLinks: [],
    streaming: [],
    fetchedAt,
  };
}

function mangaDetail(malId: number): MangaDetail {
  return {
    malId,
    url: null,
    title: `Manga ${malId}`,
    titleEnglish: null,
    titleJapanese: null,
    titleSynonyms: [],
    imageUrl: null,
    images: { small: null, medium: null, large: null },
    synopsis: null,
    background: null,
    type: 'Manga',
    volumes: 10,
    chapters: 80,
    status: 'Publishing',
    publishing: true,
    published: { from: null, to: null, string: null },
    authors: [],
    serializations: [],
    genres: [],
    themes: [],
    demographics: [],
    score: 8.5,
    scoredBy: null,
    rank: 1,
    popularity: 1,
    members: 100,
    favorites: 10,
    relations: [],
    externalLinks: [],
    fetchedAt,
  };
}

const noImages = { small: null, medium: null, large: null };

function characterDetail(malId: number): CharacterDetail {
  return {
    malId,
    url: null,
    name: `Character ${malId}`,
    nameKanji: null,
    imageUrl: null,
    images: noImages,
    about: null,
    favorites: 10,
    fetchedAt,
  };
}

function producerDetail(malId: number): ProducerDetail {
  return { malId, url: null, name: `Producer ${malId}`, imageUrl: null, established: null, favorites: 5, fetchedAt };
}

function clubDetail(malId: number): ClubDetail {
  return {
    malId,
    url: null,
    title: `Club ${malId}`,
    members: 100,
    pictures: 5,
    category: 'Anime',
    created: null,
    staff: [],
    fetchedAt,
  };
}

function personDetail(malId: number): PersonDetail {
  return {
    malId,
    url: null,
    name: `Person ${malId}`,
    givenName: null,
    familyName: null,
    alternateNames: null,
    birthday: null,
    website: null,
    imageUrl: null,
    images: noImages,
    about: null,
    favorites: 5,
    fetchedAt,
  };
}

beforeAll(async () => applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS));
beforeEach(async () => {
  for (const table of ['anime', 'manga', 'characters', 'producers', 'clubs', 'people', 'catalog_lists'])
    await bindings.DB.prepare(`DELETE FROM ${table}`).run();
});

describe('D1 integration: catalog repositories', () => {
  it('upserts anime detail idempotently', async () => {
    const repo = new AnimeRepository(bindings.DB);
    await repo.put(detail(1), fetchedAt, 'test');
    await repo.put(detail(1), fetchedAt, 'test');
    expect((await repo.get(1))?.title).toBe('Anime 1');
    expect((await bindings.DB.prepare('SELECT COUNT(*) count FROM anime').first<{ count: number }>())?.count).toBe(1);
  });

  it('upserts manga detail idempotently', async () => {
    const repo = new MangaRepository(bindings.DB);
    await repo.put(mangaDetail(2), fetchedAt, 'test');
    await repo.put(mangaDetail(2), fetchedAt, 'test');
    expect((await repo.get(2))?.title).toBe('Manga 2');
    expect((await bindings.DB.prepare('SELECT COUNT(*) count FROM manga').first<{ count: number }>())?.count).toBe(1);
  });

  it('upserts character detail idempotently', async () => {
    const repo = new CharacterRepository(bindings.DB);
    await repo.put(characterDetail(1), fetchedAt, 'test');
    await repo.put(characterDetail(1), fetchedAt, 'test');
    expect((await repo.get(1))?.name).toBe('Character 1');
    expect((await bindings.DB.prepare('SELECT COUNT(*) count FROM characters').first<{ count: number }>())?.count).toBe(
      1,
    );
  });

  it('upserts producer detail idempotently', async () => {
    const repo = new ProducerRepository(bindings.DB);
    await repo.put(producerDetail(123), fetchedAt, 'test');
    await repo.put(producerDetail(123), fetchedAt, 'test');
    expect((await repo.get(123))?.name).toBe('Producer 123');
    expect((await bindings.DB.prepare('SELECT COUNT(*) count FROM producers').first<{ count: number }>())?.count).toBe(
      1,
    );
  });

  it('upserts club detail idempotently', async () => {
    const repo = new ClubRepository(bindings.DB);
    await repo.put(clubDetail(1), fetchedAt, 'test');
    await repo.put(clubDetail(1), fetchedAt, 'test');
    expect((await repo.get(1))?.title).toBe('Club 1');
    expect((await bindings.DB.prepare('SELECT COUNT(*) count FROM clubs').first<{ count: number }>())?.count).toBe(1);
  });

  it('upserts person detail idempotently', async () => {
    const repo = new PersonRepository(bindings.DB);
    await repo.put(personDetail(11), fetchedAt, 'test');
    await repo.put(personDetail(11), fetchedAt, 'test');
    expect((await repo.get(11))?.name).toBe('Person 11');
    expect((await bindings.DB.prepare('SELECT COUNT(*) count FROM people').first<{ count: number }>())?.count).toBe(1);
  });

  it('random picks a locally cached entry and 404s when the table is empty', async () => {
    const random = new RandomService(bindings.DB);
    await expect(random.pick('anime')).rejects.toMatchObject({ code: 'NO_LOCAL_ENTRIES', status: 404 });
    await new AnimeRepository(bindings.DB).put(detail(42), fetchedAt, 'test');
    const picked = await random.pick('anime');
    expect((picked.data as AnimeDetail).malId).toBe(42);
    // The row's own timestamp comes back with it: this read path never refreshes, so it is the only
    // thing that tells a caller how old the picked entity is.
    expect(picked.fetchedAt).toBe(fetchedAt);
  });

  it('stores and overwrites list-shaped catalog resources by key', async () => {
    const repo = new CatalogListRepository(bindings.DB);
    // GenreTaxonomyEntry gained count and type in the 2026-07-30 contract change; this fixture
    // predated that and tsconfig excludes tests/integration/** from typecheck, so a missing
    // required field here would not have failed anywhere.
    const action: GenreTaxonomyEntry = {
      malId: 1,
      name: 'Action',
      url: 'https://myanimelist.net/anime/genre/1/Action',
      count: 100,
      type: 'genres',
    };
    const adventure: GenreTaxonomyEntry = {
      malId: 2,
      name: 'Adventure',
      url: 'https://myanimelist.net/anime/genre/2/Adventure',
      count: 50,
      type: 'genres',
    };
    await repo.put('catalog:genres:anime', [action], fetchedAt, 'test');
    await repo.put('catalog:genres:anime', [action, adventure], fetchedAt, 'test');
    const stored = await repo.get<GenreTaxonomyEntry[]>('catalog:genres:anime');
    expect(stored).toHaveLength(2);
    expect(await repo.get('catalog:top:anime:page:1')).toBeNull();
  });
});
