import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isMissingEpisode, parseEpisodeDetail } from '../../src/parsers/episode-detail.parser';

// The heading and notice of `/anime/21/x/episode/99999`, as MAL served them on 2026-10-11 — with a
// 200, which is why the page itself has to say the episode is missing.
const missing = readFileSync('tests/fixtures/episodes/episode-detail-missing-real.html', 'utf8');

describe('an episode MAL has no page for', () => {
  it('is recognised by its notice', () => {
    expect(isMissingEpisode(missing)).toBe(true);
  });

  // Without the check the parser happily returns every field null, which production served as a 200.
  it('is what the parser alone would have turned into an all-null episode', () => {
    expect(parseEpisodeDetail(missing, 21, 99_999)).toMatchObject({ title: null, synopsis: null });
  });

  it('does not match a real episode list row', () => {
    expect(isMissingEpisode(readFileSync('tests/fixtures/episodes/one-piece-filler-real.html', 'utf8'))).toBe(false);
  });
});
