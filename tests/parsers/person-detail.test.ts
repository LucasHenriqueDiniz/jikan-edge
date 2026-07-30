import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePersonDetail } from '../../src/parsers/person-detail.parser';

const html = readFileSync('tests/fixtures/people/detail-valid.html', 'utf8');

describe('person detail parser', () => {
  it('normalizes a public person detail page', () => {
    const detail = parsePersonDetail(html, 11, '2026-07-26T00:00:00.000Z');
    expect(detail.name).toBe('Yamadera, Kouichi');
    expect(detail.givenName).toBe('宏一');
    expect(detail.familyName).toBe('山寺');
    expect(detail.alternateNames).toBe('Koichi Yamadera');
    expect(detail.birthday).toBe('Jun 17, 1961');
    expect(detail.website).toBe('https://across-ent.com');
    expect(detail.url).toBe('https://myanimelist.net/people/11/Kouichi_Yamadera');
    expect(detail.imageUrl).toContain('voiceactors');
    // A person is the mirror image of a character: `l` exists, `t` is a 404.
    expect(detail.images.small).toBeNull();
    expect(detail.images.medium).toBe(detail.imageUrl);
    expect(detail.images.large).toBe(detail.imageUrl?.replace(/\.jpg$/, 'l.jpg'));
    expect(detail.favorites).toBe(1_615);
    expect(detail.about).toContain('He voiced Spike Spiegel');
  });
});
