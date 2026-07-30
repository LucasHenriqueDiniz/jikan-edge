import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMoreInfo } from '../../src/parsers/more-info.parser';

describe('more info parser', () => {
  it('extracts free-form curator notes', () => {
    const html = readFileSync('tests/fixtures/anime/moreinfo-valid.html', 'utf8');
    const result = parseMoreInfo(html);
    // Paragraph breaks survive: MAL separates these lines with <br>, and flattening them into
    // spaces is what turned every long-form field in this API into a wall of text.
    expect(result.text).toBe('Suggested Order of Viewing\n\n1. TV Series (26 episodes)\n\n2. Movie (takes place between episodes 22 and 23)');
  });

  it('returns null text when the title has no More Info section', () => {
    const html = readFileSync('tests/fixtures/anime/moreinfo-empty.html', 'utf8');
    expect(parseMoreInfo(html)).toEqual({ text: null });
  });
});
