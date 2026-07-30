import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCharacterDetail } from '../../src/parsers/character-detail.parser';

const html = readFileSync('tests/fixtures/characters/detail-valid.html', 'utf8');

describe('character detail parser', () => {
  it('normalizes a public character detail page', () => {
    const detail = parseCharacterDetail(html, 1, '2026-07-26T00:00:00.000Z');
    expect(detail.name).toBe('Spike Spiegel');
    expect(detail.nameKanji).toBe('スパイク・スピーゲル');
    expect(detail.url).toBe('https://myanimelist.net/character/1/Spike_Spiegel');
    expect(detail.imageUrl).toContain('cdn.myanimelist.net');
    // A character has no `l` variant on the CDN â€” deriving one would publish a 404.
    expect(detail.images.small).toBe(detail.imageUrl?.replace(/\.jpg$/, 't.jpg'));
    expect(detail.images.medium).toBe(detail.imageUrl);
    expect(detail.images.large).toBeNull();
    expect(detail.favorites).toBe(49_189);
    expect(detail.about).toContain('Spike Spiegel is a tall and lean bounty hunter');
  });
});
