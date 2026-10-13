import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAnimeDetail } from '../../src/parsers/anime-detail.parser';
import { extractRelations } from '../../src/parsers/relations-links';

// Both fixtures are contiguous excerpts of the real pages, fetched through Cloudflare's network on
// 2026-10-11. The One Piece one is the page's first 132 KB, cut right after the relations table.
const onePiece = readFileSync('tests/fixtures/anime/detail-one-piece-real.html', 'utf8');
const berserk = readFileSync('tests/fixtures/manga/relations-berserk-real.html', 'utf8');

const countBy = (relations: { relation: string }[]) =>
  relations.reduce<Record<string, number>>((counts, { relation }) => {
    counts[relation] = (counts[relation] ?? 0) + 1;
    return counts;
  }, {});

describe('related entries', () => {
  // The tiles alone are two entries; the table under them holds the other 92. Reading only the tiles
  // is what this API served — 2 of 94, measured against the live page and against Tenrai.
  it("reads One Piece's tiles and its entries-table, 94 relations in all", () => {
    const relations = extractRelations(onePiece);
    expect(relations).toHaveLength(94);
    expect(countBy(relations)).toEqual({
      Adaptation: 2,
      'Side Story': 37,
      Summary: 31,
      'Alternative Version': 3,
      Character: 7,
      Other: 14,
    });
    expect(relations).toContainEqual({
      relation: 'Side Story',
      type: 'anime',
      malId: 466,
      title: 'One Piece: Taose! Kaizoku Ganzack',
    });
  });

  // Entries MAL folds behind its "more" toggle are still in the markup, flagged `hide-entry`.
  it('keeps the entries MAL hides behind its toggle', () => {
    expect(onePiece).toContain('hide-entry');
    expect(extractRelations(onePiece)).toContainEqual(expect.objectContaining({ malId: 1094 }));
  });

  // Seven adaptations as tiles, and the two manga-to-manga relations only in the table.
  it("reads Berserk's Spin-Off and Other rows, 9 relations in all", () => {
    const relations = extractRelations(berserk);
    expect(relations).toHaveLength(9);
    expect(countBy(relations)).toEqual({ Adaptation: 7, 'Spin-Off': 1, Other: 1 });
    expect(relations).toContainEqual({
      relation: 'Spin-Off',
      type: 'manga',
      malId: 106677,
      title: 'Shousetsu Berserk: Enryuu no Kishi',
    });
    expect(relations).toContainEqual({
      relation: 'Other',
      type: 'manga',
      malId: 92299,
      title: 'Berserk: Shinen no Kami 2',
    });
  });
});

describe('anime synopsis on a long page', () => {
  // The synopsis starts at byte 96,736 of this page, past the 90 KB prefix the parser used to read,
  // so production served One Piece with `synopsis: null`.
  it('is read wherever it starts', () => {
    expect(onePiece.indexOf('<p itemprop="description">')).toBeGreaterThan(90_000);
    const detail = parseAnimeDetail(onePiece, 21, '2026-10-11T00:00:00.000Z');
    expect(detail.synopsis).toMatch(/^Barely surviving in a barrel after passing through a terrible whirlpool at sea/);
    expect(detail.title).toBe('One Piece');
    expect(detail.relations).toHaveLength(94);
  });
});
