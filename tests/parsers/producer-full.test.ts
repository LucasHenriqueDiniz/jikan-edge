import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseProducerFull } from '../../src/parsers/producer-full.parser';

const html = readFileSync('tests/fixtures/producers/full-valid.html', 'utf8');

describe('producer full parser', () => {
  it('extracts about text and external links alongside base detail fields', () => {
    const full = parseProducerFull(html, 1, '2026-07-26T00:00:00.000Z');
    expect(full.malId).toBe(1);
    expect(full.name).toBe('Studio Pierrot');
    expect(full.established).toBe('May, 1979');
    expect(full.favorites).toBe(6417);
    expect(full.about).toBe('Pierrot is a Japanese animation studio established in May 1979.');
    expect(full.external).toEqual([
      { name: 'pierrot.jp', url: 'http://pierrot.jp/' },
      { name: 'en.pierrot.jp', url: 'https://en.pierrot.jp/' },
      { name: 'Facebook', url: 'https://www.facebook.com/studiopierrot' },
      { name: 'ja.wikipedia.org', url: 'https://ja.wikipedia.org/wiki/%E3%81%B4%E3%81%88%E3%82%8D' },
      { name: 'anisearch.com', url: 'https://www.anisearch.com/company/212,pierrot-co-ltd' },
    ]);
  });
});
