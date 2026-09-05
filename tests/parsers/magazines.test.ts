import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMagazines } from '../../src/parsers/magazines.parser';

function buildLargeFixture(count: number): string {
  const entries = Array.from(
    { length: count },
    (_, index) =>
      `<a href="/manga/magazine/${index + 1}/Mag_${index + 1}" class="genre-name-link">Mag ${index + 1} (${index + 1})</a>`,
  ).join('\n');
  return `<!doctype html><html><body>${entries}</body></html>`;
}

describe('magazines parser', () => {
  it('extracts a large magazine directory', () => {
    const magazines = parseMagazines(buildLargeFixture(600));
    expect(magazines.length).toBe(600);
    expect(magazines[0]).toEqual({
      malId: 1,
      name: 'Mag 1',
      count: 1,
      url: 'https://myanimelist.net/manga/magazine/1/Mag_1',
    });
  });

  it('rejects an implausibly short magazine directory', () => {
    const html = readFileSync('tests/fixtures/magazines/short-list.html', 'utf8');
    expect(() => parseMagazines(html)).toThrow('invalid_magazine_list');
  });
});
