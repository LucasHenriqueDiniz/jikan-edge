import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAnimeDetail } from '../../src/parsers/anime-detail.parser';
import { parseMangaDetail } from '../../src/parsers/manga-detail.parser';
import { parseTopAnime } from '../../src/parsers/top-anime.parser';
import * as jikan from '../../src/http/jikan';
import type { UserMediaListEntry } from '../../src/domain/list-entry';

/**
 * Measures what the Jikan conversion actually added at the edge: the mapper call plus the
 * serialization of a larger payload, against the old behaviour of stringifying the domain
 * object as-is.
 *
 * These are Node numbers on whatever machine runs the suite, not Workers cpuTime — the
 * production figures in docs/results/ came from `wrangler tail`. What transfers is the ratio
 * and the response-size delta, not the absolute milliseconds.
 */

const SAMPLES = 200;

function measure(label: string, baseline: () => unknown, mapped: () => unknown) {
  const run = (fn: () => unknown) => {
    for (let i = 0; i < 20; i += 1) fn(); // warm up so V8 has settled on a shape
    const samples: number[] = [];
    for (let i = 0; i < SAMPLES; i += 1) {
      const started = performance.now();
      fn();
      samples.push(performance.now() - started);
    }
    return samples.sort((a, b) => a - b);
  };
  const before = run(baseline);
  const after = run(mapped);
  const pick = (s: number[], q: number) => s[Math.floor(s.length * q)];
  const report = {
    benchmark: label,
    before: { p50: pick(before, 0.5), p95: pick(before, 0.95) },
    after: { p50: pick(after, 0.5), p95: pick(after, 0.95) },
    deltaP95Ms: pick(after, 0.95) - pick(before, 0.95),
    bytesBefore: JSON.stringify(baseline()).length,
    bytesAfter: JSON.stringify(mapped()).length,
  };
  console.log(JSON.stringify(report));
  return report;
}

describe('jikan mapping cost', () => {
  it('anime detail: mapper + serialize vs serializing the domain object', () => {
    const detail = parseAnimeDetail(readFileSync('tests/fixtures/anime/detail-valid.html', 'utf8'), 1);
    const report = measure('anime-detail', () => JSON.stringify(detail), () => JSON.stringify(jikan.animeDetail(detail)));
    expect(report.after.p95).toBeLessThan(2);
  });

  it('manga detail: mapper + serialize vs serializing the domain object', () => {
    const detail = parseMangaDetail(readFileSync('tests/fixtures/manga/detail-valid.html', 'utf8'), 2);
    const report = measure('manga-detail', () => JSON.stringify(detail), () => JSON.stringify(jikan.mangaDetail(detail)));
    expect(report.after.p95).toBeLessThan(2);
  });

  it('top-anime page: a real ranking list straight off the fixture', () => {
    const entries = parseTopAnime(readFileSync('tests/fixtures/anime/top-anime-page1.html', 'utf8'));
    const report = measure('top-anime-list', () => JSON.stringify(entries), () => JSON.stringify(jikan.animeList(entries)));
    expect(report.after.p95).toBeLessThan(4);
  });

  it('300-entry user list: the widest payload any route can produce', () => {
    const report = measure('user-list-300', () => JSON.stringify(listOf300()), () => JSON.stringify(jikan.userMediaList(listOf300())));
    expect(report.after.p95).toBeLessThan(8);
  });

  /**
   * Splits the added cost into its two parts: building the Jikan object, and serializing a
   * bigger one. Only run against the 300-entry list — at detail-route sizes (~10µs) the
   * timings sit under this environment's noise floor and the split is not readable.
   */
  it('attributes the added cost between mapper and serialization', () => {
    const entries = listOf300();
    const mapped = jikan.userMediaList(entries);
    const p95 = (fn: () => unknown) => {
      for (let i = 0; i < 50; i += 1) fn();
      const samples: number[] = [];
      for (let i = 0; i < SAMPLES; i += 1) {
        const started = performance.now();
        fn();
        samples.push(performance.now() - started);
      }
      return samples.sort((a, b) => a - b)[Math.floor(SAMPLES * 0.95)];
    };
    console.log(JSON.stringify({
      benchmark: 'user-list-300-split',
      stringifyDomainOnly: p95(() => JSON.stringify(entries)),
      mapperOnly: p95(() => jikan.userMediaList(entries)),
      stringifyMappedOnly: p95(() => JSON.stringify(mapped)),
    }));
  });
});

/** 300 is the documented `limit` ceiling, so this is the worst case for list serialization. */
function listOf300(): UserMediaListEntry[] {
  return Array.from({ length: 300 }, (_, index) => ({
      username: 'bench',
      mediaType: 'anime',
      malId: index + 1,
      title: `Entry number ${index + 1}`,
      imageUrl: `https://cdn.myanimelist.net/images/anime/${index}/${index}.jpg`,
      status: 'Completed',
      score: 8,
      progress: 24,
      total: 24,
      startedAt: '2024-01-01',
      finishedAt: '2024-02-01',
      updatedAt: '2024-02-01T00:00:00.000Z',
      fetchedAt: '2026-07-28T00:00:00.000Z',
      sourceVersion: 'bench',
  }));
}
