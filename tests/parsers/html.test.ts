import { describe, expect, it } from 'vitest';
import {
  anchorTexts, capture, COMPANY_LOGO_IMAGE, COVER_IMAGE, decodeHtml, imageFrom, imageVariants,
  labelBlock, labelValue, numeric, originalImage, PORTRAIT_IMAGE, rankedValue, richText,
  taggedImage, VOICE_ACTOR_IMAGE,
} from '../../src/parsers/html';

describe('decodeHtml', () => {
  it('decodes numeric entities, both hex and decimal', () => {
    expect(decodeHtml('&#x27;&#039;')).toBe("''");
  });

  it('decodes the named entities it knows', () => {
    expect(decodeHtml('Fruits&amp;Veg &quot;quoted&quot;&nbsp;end')).toBe('Fruits&Veg "quoted" end');
  });

  it('replaces tags with a space rather than deleting them', () => {
    // Deleting would weld words together across a tag boundary.
    expect(decodeHtml('one<br>two')).toBe('one two');
  });

  it('collapses runs of whitespace and trims', () => {
    expect(decodeHtml('  a \n\n  b  ')).toBe('a b');
  });
});

describe('decodeHtml — entities beyond the original table', () => {
  it('decodes the punctuation MAL actually writes in prose', () => {
    // `&mdash;` used to reach the API raw, visible in /v1/anime/5114 and /v1/manga/2.
    expect(decodeHtml('Guts &mdash; the Black Swordsman')).toBe('Guts — the Black Swordsman');
    expect(decodeHtml('wait&hellip; &rsquo;tis fine')).toBe('wait… ’tis fine');
  });

  it('leaves an entity it does not know alone instead of guessing', () => {
    expect(decodeHtml('three &frac34; parts')).toBe('three &frac34; parts');
  });

  it('strips tags before decoding, so a literal &lt;b&gt; survives as text', () => {
    // Decoding first would turn this into a real <b> and the tag stripper would eat it.
    expect(decodeHtml('a &lt;b&gt; tag')).toBe('a <b> tag');
  });

  it('handles code points above the BMP', () => {
    expect(decodeHtml('&#x1F600;')).toBe('😀');
  });
});

describe('richText', () => {
  it('keeps paragraph breaks that <br> encodes', () => {
    expect(richText('one<br><br>two')).toBe('one\n\ntwo');
  });

  it('collapses horizontal whitespace but never newlines', () => {
    expect(richText('a   b<br>c   d')).toBe('a b\nc d');
  });

  it('caps runs of blank lines at one', () => {
    expect(richText('a<br><br><br><br>b')).toBe('a\n\nb');
  });

  it('drops the surrounding whitespace on each line', () => {
    expect(richText('  a  <br>   b   ')).toBe('a\nb');
  });

  it('still decodes entities and strips other tags', () => {
    expect(richText('Guts &mdash; <i>the</i> Swordsman')).toBe('Guts — the Swordsman');
  });
});

describe('originalImage', () => {
  it('drops the resize segment and the signature', () => {
    expect(originalImage('https://cdn.myanimelist.net/r/50x70/images/anime/1/2.jpg?s=abc'))
      .toBe('https://cdn.myanimelist.net/images/anime/1/2.jpg');
  });

  it('leaves an already-original URL untouched', () => {
    const url = 'https://cdn.myanimelist.net/images/anime/1/2.jpg';
    expect(originalImage(url)).toBe(url);
  });

  it('handles a signature without a resize segment, as producer logos have', () => {
    expect(originalImage('https://cdn.myanimelist.net/s/common/company_logos/abc_600x600_i?s=def'))
      .toBe('https://cdn.myanimelist.net/s/common/company_logos/abc_600x600_i');
  });

  it('passes null through', () => {
    expect(originalImage(null)).toBeNull();
  });
});

describe('imageVariants', () => {
  const anime = 'https://cdn.myanimelist.net/r/50x70/images/anime/1/2.jpg?s=abc';

  it('derives both variants where the CDN serves both', () => {
    expect(imageVariants(anime, 'anime')).toEqual({
      small: 'https://cdn.myanimelist.net/images/anime/1/2t.jpg',
      medium: 'https://cdn.myanimelist.net/images/anime/1/2.jpg',
      large: 'https://cdn.myanimelist.net/images/anime/1/2l.jpg',
    });
  });

  // Measured against the real CDN: the suffixes are not uniform, and deriving the missing one
  // would publish a 404.
  it('omits the large variant for characters, which 404s', () => {
    const set = imageVariants('https://cdn.myanimelist.net/images/characters/1/2.jpg', 'character');
    expect(set.small).toBe('https://cdn.myanimelist.net/images/characters/1/2t.jpg');
    expect(set.large).toBeNull();
  });

  it('omits the small variant for people, which 404s', () => {
    const set = imageVariants('https://cdn.myanimelist.net/images/voiceactors/1/2.jpg', 'person');
    expect(set.small).toBeNull();
    expect(set.large).toBe('https://cdn.myanimelist.net/images/voiceactors/1/2l.jpg');
  });

  it('gives up on URLs with no file extension, like producer logos', () => {
    const set = imageVariants('https://cdn.myanimelist.net/s/common/company_logos/abc_600x600_i', 'anime');
    expect(set).toEqual({
      small: null,
      medium: 'https://cdn.myanimelist.net/s/common/company_logos/abc_600x600_i',
      large: null,
    });
  });

  it('returns an all-null set for a missing image', () => {
    expect(imageVariants(null, 'anime')).toEqual({ small: null, medium: null, large: null });
  });
});

describe('capture', () => {
  it('returns the decoded first group', () => {
    expect(capture('<b>Cowboy &amp; Bebop</b>', /<b>([^<]+)<\/b>/i)).toBe('Cowboy & Bebop');
  });

  it('returns null when the pattern misses or the group is empty', () => {
    expect(capture('<b></b>', /<b>([^<]*)<\/b>/i)).toBeNull();
    expect(capture('nothing', /<b>([^<]+)<\/b>/i)).toBeNull();
  });
});

describe('numeric', () => {
  it('strips thousands separators', () => {
    expect(numeric('2,075,577')).toBe(2_075_577);
  });

  it('returns null for null, empty and non-numeric input', () => {
    expect(numeric(null)).toBeNull();
    expect(numeric('')).toBeNull();
    expect(numeric('N/A')).toBeNull();
  });
});

describe('imageFrom', () => {
  const real = 'https://cdn.myanimelist.net/images/anime/4/19644.jpg';

  it('prefers data-src over src, because src holds the lazy-load spacer', () => {
    const tag = `<img src="https://cdn.myanimelist.net/images/spacer.gif" data-src="${real}" class="lazyload">`;
    expect(imageFrom(tag)).toBe(real);
  });

  it('walks the whole fallback chain', () => {
    expect(imageFrom(`<img data-srcset="${real} 1x, other 2x">`)).toBe(real);
    expect(imageFrom(`<img srcset="${real} 1x">`)).toBe(real);
    expect(imageFrom(`<img src="${real}">`)).toBe(real);
  });

  it('rejects the spacer even when it is the only candidate', () => {
    expect(imageFrom('<img src="https://cdn.myanimelist.net/images/spacer.gif">')).toBeNull();
  });

  it('rejects relative and non-https URLs, which would fail url() validation downstream', () => {
    expect(imageFrom('<img data-src="/images/anime/4/19644.jpg">')).toBeNull();
    expect(imageFrom('<img data-src="http://cdn.myanimelist.net/x.jpg">')).toBeNull();
  });

  it('normalises the resize prefix and signature away', () => {
    // The list pages embed a 50x70 stamp; the poster lives at the same path without /r/ and ?s=.
    const thumb = 'https://cdn.myanimelist.net/r/50x70/images/anime/1015/138006.jpg?s=09c2f2de';
    expect(imageFrom(`<img data-src="${thumb}">`)).toBe('https://cdn.myanimelist.net/images/anime/1015/138006.jpg');
  });

  it('does not mistake data-srcset for data-src', () => {
    const other = 'https://cdn.myanimelist.net/images/anime/9/9999.jpg';
    expect(imageFrom(`<img data-srcset="${other} 1x" data-src="${real}">`)).toBe(real);
  });

  it('returns null when there is no image at all', () => {
    expect(imageFrom('<div>no image here</div>')).toBeNull();
  });
});

describe('taggedImage', () => {
  const page = [
    '<img class="portrait-225x350" data-src="https://cdn.myanimelist.net/images/characters/11/516853.jpg">',
    '<img itemprop="image" data-src="https://cdn.myanimelist.net/images/anime/4/19644.jpg">',
    '<img data-src="https://cdn.myanimelist.net/images/voiceactors/1/85360.jpg">',
    '<img data-src="https://cdn.myanimelist.net/s/common/company_logos/abc_600x600_i">',
  ].join('\n');

  it('picks the tag its anchor names, not the first image on the page', () => {
    expect(taggedImage(page, COVER_IMAGE)).toContain('/anime/4/19644.jpg');
    expect(taggedImage(page, PORTRAIT_IMAGE)).toContain('/characters/11/516853.jpg');
    expect(taggedImage(page, VOICE_ACTOR_IMAGE)).toContain('/voiceactors/1/85360.jpg');
    expect(taggedImage(page, COMPANY_LOGO_IMAGE)).toContain('company_logos');
  });

  it('returns null when the anchor matches nothing', () => {
    expect(taggedImage('<div></div>', COVER_IMAGE)).toBeNull();
  });
});

describe('labelValue / labelBlock', () => {
  // Markup copied from a real MAL sidebar: label in a span, values as anchors carrying the id.
  const sidebar = '<div class="spaceit_pad"> <span class="dark_text">Studios:</span> '
    + '<a href="/anime/producer/14/Sunrise" title="Sunrise">Sunrise</a> </div>'
    + '<div class="spaceit_pad"> <span class="dark_text">Genres:</span> '
    + '<a href="/anime/genre/1/Action" title="Action">Action</a>, '
    + '<a href="/anime/genre/46/Award_Winning" title="Award Winning">Award Winning</a> </div>'
    + '<div> <span class="dark_text">Ranked:</span> #49<sup>2</sup></div>';

  it('takes the first label that matches, so singular and plural both work', () => {
    expect(labelValue(sidebar, 'Studios', 'Studio')).toBe('Sunrise');
    expect(labelValue(sidebar, 'Studio', 'Studios')).toBe('Sunrise');
  });

  it('returns null when no label matches', () => {
    expect(labelValue(sidebar, 'Licensors')).toBeNull();
    expect(labelBlock(sidebar, 'Licensors')).toBe('');
  });

  it('keeps the raw HTML, so the MAL id in the href survives', () => {
    expect(labelBlock(sidebar, 'Genres')).toContain('/anime/genre/1/Action');
  });

  it('reads the # form that Ranked and Popularity use', () => {
    expect(rankedValue(sidebar, 'Ranked')).toBe(49);
    expect(rankedValue(sidebar, 'Popularity')).toBeNull();
  });

  it('anchorTexts keeps only the link text', () => {
    expect(anchorTexts(labelBlock(sidebar, 'Genres'))).toEqual(['Action', 'Award Winning']);
  });
});
