import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyPatches, configPatches, CONFIG_PATH, databaseIdFrom, parseArgs, parseJsonOutput } from '../../scripts/setup.mjs';

// Patching runs against the real wrangler.jsonc, not a fixture: if the file is ever reformatted so a
// pattern stops matching, this fails here rather than in a self-hoster's first command.
const CONFIG = readFileSync(CONFIG_PATH, 'utf8');
const ID = '11111111-2222-3333-4444-555555555555';
const patched = (options) => applyPatches(CONFIG, configPatches({ databaseId: ID, dbName: 'jikan-edge', ...options }));

describe('setup argument parsing', () => {
  it('reads flags with and without values', () => {
    expect(parseArgs(['--db-name=my-db', '--worker-name=my-worker', '--yes'])).toEqual({ 'db-name': 'my-db', 'worker-name': 'my-worker', yes: true });
  });

  it('keeps the "=" inside a URL value', () => {
    expect(parseArgs(['--contact=https://example.com/?a=b'])['contact']).toBe('https://example.com/?a=b');
  });
});

describe('reading the database id out of wrangler', () => {
  it('finds the requested database by name', () => {
    const output = JSON.stringify([{ uuid: 'other', name: 'something-else' }, { uuid: ID, name: 'jikan-edge' }]);
    expect(databaseIdFrom(output, 'jikan-edge')).toBe(ID);
  });

  it('ignores a banner printed before the JSON', () => {
    expect(parseJsonOutput(` ⛅️ wrangler 4.112.0\n─────────\n[{"uuid":"${ID}","name":"jikan-edge"}]`)).toEqual([{ uuid: ID, name: 'jikan-edge' }]);
  });

  it('reports nothing rather than guessing when the database is absent', () => {
    expect(databaseIdFrom(JSON.stringify([{ uuid: ID, name: 'other' }]), 'jikan-edge')).toBeNull();
  });

  it('survives output that is not JSON at all', () => {
    expect(databaseIdFrom('Authentication error [code: 10000]', 'jikan-edge')).toBeNull();
  });
});

describe('patching wrangler.jsonc', () => {
  it('writes the database id into the D1 binding', () => {
    expect(patched({})).toMatch(new RegExp(`"database_id":\\s*"${ID}"`));
  });

  it('leaves the rest of the config, including its comments, intact', () => {
    const result = patched({});
    expect(result).toContain('"binding": "DB"');
    expect(result).toContain('// Forking this?');
    expect(result.split('\n').length).toBe(CONFIG.split('\n').length);
  });

  // The rate limiters carry a `"name"` too — renaming one of those would silently split a fork's
  // rate-limit counters instead of renaming the Worker.
  it('renames the Worker without touching the rate limiter names', () => {
    const result = patched({ workerName: 'my-jikan' });
    expect(result).toMatch(/^\s*"name": "my-jikan",$/m);
    expect(result).toContain('"name": "API_RATE_LIMIT"');
    expect(result).toContain('"name": "API_BURST_LIMIT"');
  });

  it('points the MyAnimeList user agent at the fork', () => {
    expect(patched({ contact: 'https://mine.workers.dev' })).toContain('"MAL_USER_AGENT": "jikan-edge/0.1 (+https://mine.workers.dev)"');
  });

  it('leaves the user agent alone when no contact is given', () => {
    expect(patched({})).toContain('"MAL_USER_AGENT": "jikan-edge/0.1 (+https://jikan-edge.lucas-hdo.workers.dev)"');
  });

  it('refuses to write a half-patched config when a pattern stops matching', () => {
    expect(() => applyPatches('{ "no": "match" }', configPatches({ databaseId: ID, dbName: 'jikan-edge' }))).toThrow(/edit it by hand/);
  });
});
