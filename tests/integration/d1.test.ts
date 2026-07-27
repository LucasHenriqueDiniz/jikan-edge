import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyD1Migrations, env } from 'cloudflare:test';
import { CacheRepository } from '../../src/repositories/cache.repository';
import { RefreshLockRepository } from '../../src/repositories/refresh-lock.repository';
import { UserRepository } from '../../src/repositories/user.repository';
import type { UserProfile, UserStatistics } from '../../src/domain/user';
import type { UserMediaListEntry } from '../../src/domain/list-entry';

const bindings = env as unknown as { DB: D1Database; TEST_MIGRATIONS: import('cloudflare:test').D1Migration[] };
const fetchedAt = '2026-07-19T00:00:00.000Z';
const profile: UserProfile = { username: 'CaseUser', canonicalUsername: 'CaseUser', profileUrl: 'https://myanimelist.net/profile/CaseUser', avatarUrl: null, about: null, gender: null, location: null, birthday: null, joinedAt: null, lastOnlineAt: null, fetchedAt, sourceVersion: 'test' };
const statistics: UserStatistics = { anime: { watching: 1, completed: 2, onHold: 0, dropped: 0, planToWatch: 3, totalEntries: 6, episodesWatched: 12, meanScore: 8 }, manga: { reading: 1, completed: 0, onHold: 0, dropped: 0, planToRead: 0, totalEntries: 1, chaptersRead: 5, volumesRead: 1, meanScore: 7 } };
function entry(id: number, type: 'anime' | 'manga' = 'anime'): UserMediaListEntry { return { username: 'caseuser', mediaType: type, malId: id, title: `Title ${id}`, imageUrl: null, status: null, score: null, progress: null, total: null, startedAt: null, finishedAt: null, updatedAt: null, fetchedAt, sourceVersion: 'test' }; }

beforeAll(async () => applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS));
beforeEach(async () => { for (const table of ['user_media_list_entries', 'user_statistics', 'users', 'cache_entries', 'refresh_leases']) await bindings.DB.prepare(`DELETE FROM ${table}`).run(); });

describe('D1 integration: persistence and cache', () => {
  it('upserts profile/statistics idempotently and normalizes username', async () => {
    const users = new UserRepository(bindings.DB); await users.saveProfile(profile, statistics); await users.saveProfile(profile, statistics);
    expect((await users.getProfile('caseuser'))?.canonicalUsername).toBe('CaseUser');
    expect((await bindings.DB.prepare('SELECT COUNT(*) count FROM users').first<{ count: number }>())?.count).toBe(1);
    expect((await users.getStatistics('caseuser'))?.anime.completed).toBe(2);
  });
  it('replaces a complete list atomically and keeps media types separate', async () => {
    const users = new UserRepository(bindings.DB); await users.replaceList('caseuser', 'anime', [entry(1), entry(2)]); await users.replaceList('caseuser', 'manga', [entry(9, 'manga')]); await users.replaceList('caseuser', 'anime', [entry(2)]);
    expect((await users.listEntries('caseuser', 'anime', 1, 10)).entries.map((item) => item.malId)).toEqual([2]);
    expect((await users.listEntries('caseuser', 'manga', 1, 10)).total).toBe(1);
  });
  it('marks cache fresh or stale from real D1 timestamps', async () => {
    const cache = new CacheRepository(bindings.DB); await cache.put({ resourceKey: 'x', fetchedAt, expiresAt: '2999-01-01T00:00:00.000Z', sourceStatus: 'success', parserVersion: 'test' }); expect(cache.isFresh((await cache.get('x'))!)).toBe(true);
    await cache.put({ resourceKey: 'x', fetchedAt, expiresAt: '2000-01-01T00:00:00.000Z', sourceStatus: 'success', parserVersion: 'test' }); expect(cache.isFresh((await cache.get('x'))!)).toBe(false);
  });
});

describe('D1 integration: refresh leases', () => {
  it('permits exactly one concurrent owner per key and allows distinct keys', async () => {
    const leases = new RefreshLockRepository(bindings.DB); const same = await Promise.all(['a', 'b'].map((owner) => leases.acquire('same', owner))); expect(same.filter(Boolean)).toHaveLength(1);
    expect(await Promise.all([leases.acquire('one', 'a'), leases.acquire('two', 'b')])).toEqual([true, true]);
  });
  it('does not release another owner and recovers an expired lease', async () => {
    const leases = new RefreshLockRepository(bindings.DB); await bindings.DB.prepare("INSERT INTO refresh_leases(resource_key, owner, acquired_at, expires_at) VALUES ('x','old','2000-01-01','2000-01-01')").run(); expect(await leases.acquire('x', 'new')).toBe(true); await leases.release('x', 'wrong'); expect((await bindings.DB.prepare("SELECT owner FROM refresh_leases WHERE resource_key='x'").first<{ owner: string }>())?.owner).toBe('new'); await leases.release('x', 'new'); expect(await leases.acquire('x', 'later')).toBe(true);
  });
});
