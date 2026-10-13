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
    expect(detail.alternateNames).toEqual(['Koichi Yamadera']);
    expect(detail.birthday).toBe('Jun 17, 1961');
    expect(detail.birthDate).toBe('1961-06-17');
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

// Seki's real page up to the end of its About (fetched 2026-10-11), with three alternate names, a
// birthday padded with MAL's double space, an empty website field and inline links in the About.
describe('person detail on a real page', () => {
  const seki = parsePersonDetail(
    readFileSync('tests/fixtures/people/detail-seki-real.html', 'utf8'),
    1,
    '2026-10-11T00:00:00.000Z',
  );

  it('splits the alternate names into a list', () => {
    expect(seki.alternateNames).toEqual(['Seki Mondoya', '門戸 開', 'Monto Hiraku']);
  });

  it('keeps the birthday as printed and adds the ISO date', () => {
    expect(seki.birthday).toBe('Sep 8, 1972');
    expect(seki.birthDate).toBe('1972-09-08');
  });

  it('treats the empty website field as no website', () => {
    expect(seki.website).toBeNull();
  });

  // `Twitter: @<a href="…">seki0908</a>` used to come out as `@ seki0908`.
  it('does not put a space where an inline link was', () => {
    expect(seki.about).toContain('Twitter: @seki0908');
    expect(seki.about).toContain('Instagram: @sekitomokazu');
  });
});
