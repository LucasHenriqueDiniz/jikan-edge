import { describe, expect, it } from 'vitest';
import { richText, spanBetween } from '../../src/parsers/html';

describe('richText and inline tags', () => {
  // The shape MAL uses for a social handle in an About: `@` then the link.
  it('does not add a space where an inline tag was', () => {
    expect(richText('Twitter: @<a href="http://twitter.com/x">x</a><br />Next')).toBe('Twitter: @x\nNext');
    expect(richText('<b>bold</b><i>italic</i>')).toBe('bolditalic');
  });

  it('still separates block-level runs', () => {
    expect(richText('<div>one</div><div>two</div>')).toBe('one two');
  });
});

describe('spanBetween', () => {
  it('returns the markup between a marker and the first close after it', () => {
    expect(spanBetween('<p id="a">x</p><p id="b">y</p>', '<p id="b">', '</p>')).toBe('y');
  });

  it('finds the marker anywhere in the document, not inside a prefix', () => {
    const html = `${'x'.repeat(200_000)}<p itemprop="description">late</p>`;
    expect(spanBetween(html, '<p itemprop="description">', '</p>')).toBe('late');
  });

  it('is null when the marker or the close is missing', () => {
    expect(spanBetween('<p>', '<p id="b">', '</p>')).toBeNull();
    expect(spanBetween('<p id="b">open', '<p id="b">', '</p>')).toBeNull();
  });
});
