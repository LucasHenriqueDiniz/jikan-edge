import { describe, expect, it } from 'vitest';
import { UpdatesRepository } from '../../src/repositories/updates.repository';

// UpdatesRepository.put() used to ignore the version argument every other repository accepts,
// hardcoding the literal 'user-html-v1:updates' on every write and never updating parser_version
// on conflict — the column froze at that literal forever after the first insert. This is the only
// one of the ten cache-backed repositories that diverged from the common `(key, value, at,
// version)` shape, and it is exactly where the bug was.
describe('UpdatesRepository.put', () => {
  it('binds the given parser version instead of a hardcoded literal', async () => {
    const calls: unknown[][] = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => { calls.push(args); return { run: async () => ({ meta: { changes: 1 }, success: true }) }; },
      }),
    } as unknown as D1Database;
    const repo = new UpdatesRepository(db);

    await repo.put('xinil', { animeUpdates: [], mangaUpdates: [] } as never, '2026-08-10T00:00:00.000Z', 'user-html-v4:updates');

    expect(calls[0]).toContain('user-html-v4:updates');
    expect(calls[0]).not.toContain('user-html-v1:updates');
  });

  it('updates parser_version on conflict instead of leaving the first-written value in place', async () => {
    let sql = '';
    const db = {
      prepare: (query: string) => { sql = query; return { bind: () => ({ run: async () => ({ meta: { changes: 1 }, success: true }) }) }; },
    } as unknown as D1Database;
    const repo = new UpdatesRepository(db);

    await repo.put('xinil', { animeUpdates: [], mangaUpdates: [] } as never, '2026-08-10T00:00:00.000Z', 'user-html-v4:updates');

    expect(sql).toContain('parser_version=excluded.parser_version');
  });
});
