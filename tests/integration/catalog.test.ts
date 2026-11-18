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
import { D1CatalogStore } from '../../src/adapters/d1-catalog-store';

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
    nicknames: [],
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
    alternateNames: [],
    birthday: null,
    birthDate: null,
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
    const random = new RandomService(new D1CatalogStore(bindings.DB));
    await expect(random.pick('anime')).rejects.toMatchObject({ code: 'NO_LOCAL_ENTRIES', status: 404 });
    await new AnimeRepository(bindings.DB).put(detail(42), fetchedAt, 'test');
    const picked = await random.pick('anime');
    expect((picked.data as AnimeDetail).malId).toBe(42);
    // The row's own timestamp comes back with it: this read path never refreshes, so it is the only
    // thing that tells a caller how old the picked entity is.
    expect(picked.fetchedAt).toBe(fetchedAt);
  });

  // The probing of tests/repositories/random.repository.test.ts runs inside SQLite, so its fairness
  // is measured here, on real SQLite. 600 draws: one standard deviation is 1.9 points, so 10 points
  // leaves room for chance, not for bias.
  async function drawCounts(ids: number[], draws: number) {
    const repo = new AnimeRepository(bindings.DB);
    for (const malId of ids) await repo.put(detail(malId), fetchedAt, 'test');
    const statements: string[] = [];
    const recording = new Proxy(bindings.DB, {
      get(target, property) {
        if (property === 'prepare')
          return (sql: string) => {
            statements.push(sql);
            return target.prepare(sql);
          };
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const random = new RandomService(new D1CatalogStore(recording));
    const counts = new Map<number, number>();
    for (let draw = 0; draw < draws; draw += 1) {
      const malId = ((await random.pick('anime')).data as AnimeDetail).malId;
      counts.set(malId, (counts.get(malId) ?? 0) + 1);
    }
    return { counts, statements };
  }

  const shareOff = (counts: Map<number, number>, malId: number, draws: number, of: number) =>
    Math.abs((counts.get(malId) ?? 0) / draws - 1 / of);

  // Rows come back in key order, so a pick that took the first row found would give id 1 about half
  // the draws here.
  it('random draws uniformly over the stored ids, whatever the gaps between them', async () => {
    const { counts } = await drawCounts([1, 2, 64], 600);
    expect([...counts.keys()].sort((a, b) => a - b)).toEqual([1, 2, 64]);
    for (const malId of [1, 2, 64]) expect(shareOff(counts, malId, 600, 3)).toBeLessThan(0.1);
  });

  // Three ids spread over 900 send about three draws in four through the fallback, so this measures
  // the fallback's fairness: the first draft's `mal_id >= <random>` gave 900 about 90% of the draws.
  it('random stays uniform on a sparse table, where most draws reach the fallback', async () => {
    const { counts } = await drawCounts([3, 70, 900], 600);
    expect([...counts.keys()].sort((a, b) => a - b)).toEqual([3, 70, 900]);
    for (const malId of [3, 70, 900]) expect(shareOff(counts, malId, 600, 3)).toBeLessThan(0.1);
  });

  it('random probes a table no larger than one round whole, in one statement per pick', async () => {
    const { counts, statements } = await drawCounts([5, 32], 100);
    expect([...counts.keys()].sort((a, b) => a - b)).toEqual([5, 32]);
    expect(statements).toHaveLength(100);
  });

  it('random draws a user over the rowid of a table keyed by text', async () => {
    await bindings.DB.prepare(
      `INSERT OR IGNORE INTO users(username_key, canonical_username, profile_url, fetched_at, parser_version, source_status)
       VALUES ('xinil', 'Xinil', 'https://myanimelist.net/profile/Xinil', ?, 'test', 'success')`,
    )
      .bind(fetchedAt)
      .run();
    expect(await new RandomService(new D1CatalogStore(bindings.DB)).pickUser()).toEqual({ username: 'Xinil' });
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
