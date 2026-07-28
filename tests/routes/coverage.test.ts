import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guards the guard. The per-group contract tests are what actually prove each route emits Jikan
 * shape, but they only help for routes someone remembered to add. A new `app.get('/v1/...')` with
 * no contract test would otherwise ship unverified — which is exactly how the first pass left 41
 * routes uncovered while looking done.
 */

const app = readFileSync('src/app.ts', 'utf8');
const contractTests = readdirSync('tests/routes')
  .filter((name) => name.endsWith('.test.ts'))
  .map((name) => readFileSync(`tests/routes/${name}`, 'utf8'))
  .join('\n');

const PARAMS: [string, string][] = [
  [':username', "[^/?'\"]+"],
  [':id', '\\d+'],
  [':episode', '\\d+'],
  [':year', '\\d+'],
  [':season', '[a-z]+'],
];

function registeredRoutes(): string[] {
  return [...app.matchAll(/app\.get\(['`]([^'`]+)/g)]
    .map((match) => match[1])
    .filter((route) => route.startsWith('/v1'))
    // The random routes are registered in a loop; one concrete kind stands in for the template.
    .map((route) => route.replace('${kind}', 'anime'))
    .filter((route) => !route.includes('${'));
}

function hasContractTest(route: string): boolean {
  let pattern = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [placeholder, expression] of PARAMS) {
    pattern = pattern.replace(placeholder.replace(':', ':'), expression);
  }
  return new RegExp(`'${pattern}(\\?[^']*)?'`).test(contractTests);
}

describe('contract test coverage', () => {
  it('has a contract test for every registered /v1 route', () => {
    const uncovered = registeredRoutes().filter((route) => !hasContractTest(route));
    expect(uncovered, `routes with no contract test:\n${uncovered.join('\n')}`).toEqual([]);
  });
});
