import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyD1Migrations, env } from 'cloudflare:test';
import { UserRepository } from '../../src/repositories/user.repository';
import { MalClient } from '../../src/source/mal-client';
import { UserService } from '../../src/services/user.service';
import { ServiceError } from '../../src/services/cacheable';
import type { RuntimeConfig } from '../../src/config/env';
import type { UserProfile, UserStatistics } from '../../src/domain/user';

const bindings = env as unknown as { DB: D1Database; TEST_MIGRATIONS: import('cloudflare:test').D1Migration[] };
const config: RuntimeConfig = {
  profileTtlSeconds: 60,
  listTtlSeconds: 60,
  animeTtlSeconds: 60,
  catalogTtlSeconds: 60,
  sourceTimeoutMs: 1_000,
  maxUpstreamBytes: 50_000_000,
  malUserAgent: 'test',
};
const fetchedAt = '2026-07-30T00:00:00.000Z';

/** A modern-layout page carrying `count` entries, numbered from `from` so pages do not repeat ids. */
function listPage(count: number, from: number): string {
  const items = Array.from({ length: count }, (_, index) => ({
    status: 2,
    score: 8,
    num_watched_episodes: 12,
    anime_num_episodes: 12,
    anime_id: from + index,
    anime_title: `Title ${from + index}`,
    anime_image_path: 'https://cdn.myanimelist.net/images/anime/1/1.jpg',
    start_date_string: null,
    finish_date_string: null,
    updated_at: 0,
  }));
  return `<!doctype html><html><head><title>Anime List</title></head><body><table data-items="${JSON.stringify(items).replace(/"/g, '&quot;')}"></table></body></html>`;
}

/** Serves whatever the page factory returns, so the service sees a real MalClient over a fake network. */
function client(pageFor: (offset: number) => string): MalClient {
  return new MalClient(config, async (input) => {
    const offset = Number(new URL(String(input)).searchParams.get('offset') ?? 0);
    return new Response(pageFor(offset), { status: 200, headers: { 'content-type': 'text/html' } });
  });
}

function statistics(animeTotal: number): UserStatistics {
  return {
    anime: {
      watching: 0,
      completed: animeTotal,
      onHold: 0,
      dropped: 0,
      planToWatch: 0,
      totalEntries: animeTotal,
      rewatched: null,
      episodesWatched: null,
      daysWatched: null,
      meanScore: null,
    },
    manga: {
      reading: 0,
      completed: 0,
      onHold: 0,
      dropped: 0,
      planToRead: 0,
      totalEntries: 0,
      reread: null,
      chaptersRead: null,
      volumesRead: null,
      daysRead: null,
      meanScore: null,
    },
  };
}

const profile: UserProfile = {
  username: 'tester',
  canonicalUsername: 'tester',
  profileUrl: 'https://myanimelist.net/profile/tester',
  avatarUrl: null,
  about: null,
  gender: null,
  location: null,
  birthday: null,
  joinedAt: null,
  lastOnlineAt: null,
  fetchedAt,
};

beforeAll(async () => applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS));
beforeEach(async () => {
  for (const table of ['user_media_list_entries', 'user_statistics', 'users', 'cache_entries', 'refresh_leases'])
    await bindings.DB.prepare(`DELETE FROM ${table}`).run();
});

describe('user list completeness guards', () => {
  it('refuses to store a prefix when the list runs past the page cap', async () => {
    // Every page comes back full, so the walk can never reach the end of the list.
    const service = new UserService(
      bindings.DB,
      config,
      client((offset) => listPage(300, offset + 1)),
    );
    await expect(service.mediaList('tester', 'anime', 'req', 1, 100)).rejects.toMatchObject({
      code: 'LIST_TOO_LARGE',
      status: 501,
    });
    expect((await new UserRepository(bindings.DB).listEntries('tester', 'anime', 1, 100)).total).toBe(0);
  });

  it('rejects a snapshot holding fewer entries than the profile declares', async () => {
    await new UserRepository(bindings.DB).saveProfile(profile, statistics(360));
    const service = new UserService(
      bindings.DB,
      config,
      client(() => listPage(273, 1)),
    );
    const failure = await service.mediaList('tester', 'anime', 'req', 1, 100).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ServiceError);
    expect((failure as ServiceError).message).toContain('extracted 273 of 360');
    expect((await new UserRepository(bindings.DB).listEntries('tester', 'anime', 1, 100)).total).toBe(0);
  });

  it('stores the list when it matches the declared total', async () => {
    await new UserRepository(bindings.DB).saveProfile(profile, statistics(360));
    const service = new UserService(
      bindings.DB,
      config,
      client((offset) => (offset === 0 ? listPage(300, 1) : listPage(60, 301))),
    );
    const result = await service.mediaList('tester', 'anime', 'req', 1, 100);
    expect(result.data.total).toBe(360);
  });

  // A counter cached before the user deleted entries would otherwise reject a list that is perfectly current.
  it('accepts a list larger than a stale declared total', async () => {
    await new UserRepository(bindings.DB).saveProfile(profile, statistics(5));
    const service = new UserService(
      bindings.DB,
      config,
      client(() => listPage(40, 1)),
    );
    const result = await service.mediaList('tester', 'anime', 'req', 1, 100);
    expect(result.data.total).toBe(40);
  });

  // Without a profile refresh there is no counter to compare against; the list must still be served.
  it('serves the list when no statistics have been stored yet', async () => {
    const service = new UserService(
      bindings.DB,
      config,
      client(() => listPage(12, 1)),
    );
    const result = await service.mediaList('tester', 'anime', 'req', 1, 100);
    expect(result.data.total).toBe(12);
  });
});
