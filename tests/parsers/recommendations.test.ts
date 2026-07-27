import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRecommendations } from '../../src/parsers/recommendations.parser';

const html = readFileSync('tests/fixtures/recommendations/anime-valid.html', 'utf8');

describe('recommendations parser', () => {
  it('extracts recommendation pairs', () => {
    const entries = parseRecommendations(html);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      malId: 46488,
      title: 'Tai-Ari deshita. Ojousama wa Kakutou Game nante Shinai',
      recommendedMalId: 59360,
      recommendedTitle: 'Rock wa Lady no Tashinami deshite',
      username: 'TownsAndCities',
    });
    expect(entries[0].content).toContain('upper class all girls boarding school');
  });
});
