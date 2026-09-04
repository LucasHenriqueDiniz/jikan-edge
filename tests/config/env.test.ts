import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { configFrom, type Env } from '../../src/config/env';

// Read against the real wrangler.jsonc rather than a fixture, same reasoning as the setup tests: the
// deployed value and the in-code fallback are two places that must agree, and the failure mode when
// they drift is silent — a fork that drops the var quietly gets different limits from production.
const CONFIG = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');

function declaredVar(name: string): number {
  const match = CONFIG.match(new RegExp(`"${name}"\\s*:\\s*"(\\d+)"`));
  if (!match) throw new Error(`${name} is not declared in wrangler.jsonc`);
  return Number(match[1]);
}

describe('runtime config defaults', () => {
  it('matches what wrangler.jsonc actually deploys', () => {
    const defaults = configFrom({} as Env);
    expect(defaults.maxUpstreamBytes).toBe(declaredVar('MAX_UPSTREAM_BYTES'));
    expect(defaults.sourceTimeoutMs).toBe(declaredVar('SOURCE_TIMEOUT_MS'));
    expect(defaults.profileTtlSeconds).toBe(declaredVar('PROFILE_TTL_SECONDS'));
    expect(defaults.listTtlSeconds).toBe(declaredVar('LIST_TTL_SECONDS'));
    expect(defaults.animeTtlSeconds).toBe(declaredVar('ANIME_TTL_SECONDS'));
    expect(defaults.catalogTtlSeconds).toBe(declaredVar('CATALOG_TTL_SECONDS'));
  });

  it('admits the character pages of long-running series', () => {
    // Measured 2026-08-27 against the live pages. These are the sizes that a 2 MiB ceiling refused
    // outright, taking /characters and /staff down together for each title.
    const admitted = {
      naruto: 2_426_129,
      fairyTail: 2_660_972,
      bleach: 3_190_667,
      pokemon: 3_716_667,
      shippuden: 4_424_087,
    };
    const { maxUpstreamBytes } = configFrom({} as Env);
    for (const [title, bytes] of Object.entries(admitted)) {
      expect(maxUpstreamBytes, `${title} (${bytes} bytes) must fit`).toBeGreaterThan(bytes);
    }
    // One Piece (9.9 MB) and Detective Conan (7.3 MB) are deliberately still out: they are bounded
    // by sourceTimeoutMs, not by this limit, so raising it alone would trade a 502 for a 504.
    expect(maxUpstreamBytes).toBeLessThan(7_610_680);
  });

  it('falls back rather than trusting a value that is not a positive number', () => {
    for (const bad of ['', 'lots', '0', '-1']) {
      expect(configFrom({ MAX_UPSTREAM_BYTES: bad } as Env).maxUpstreamBytes).toBe(5 * 1024 * 1024);
    }
    expect(configFrom({ MAX_UPSTREAM_BYTES: '1234' } as Env).maxUpstreamBytes).toBe(1234);
  });

  it('lets a fork keep its own user agent, and names one when it does not', () => {
    expect(configFrom({} as Env).malUserAgent).toBe('jikan-edge/0.1');
    expect(configFrom({ MAL_USER_AGENT: 'fork/1.0' } as Env).malUserAgent).toBe('fork/1.0');
  });
});
