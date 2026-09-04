import { describe, expect, it } from 'vitest';
import type { CatalogSource } from '../../src/ports/driven/catalog-source.port';
import { SearchService } from '../../src/services/search.service';

// The filter-to-URL mapping is private, so it is observed where it becomes visible: the URL handed
// to the source client. The stub records it and then fails, which is enough — nothing past the
// fetch matters here. A validation error happens *before* any fetch, so it propagates untouched,
// which is what lets the same helper assert both mappings and refusals.
async function params(filters: Record<string, string>): Promise<URLSearchParams> {
  let seen: string | null = null;
  const source: CatalogSource = {
    getHtml: async (url: string) => {
      seen = url;
      throw new Error('stop after recording the URL');
    },
  };
  const row = { first: async () => null, run: async () => ({ meta: { changes: 1 }, success: true }) };
  const db = { prepare: () => ({ bind: () => row, ...row }) };
  const service = new SearchService(db as never, { catalogTtlSeconds: 1 } as never, source);

  try {
    await service.anime('naruto', 1, filters, 'req');
  } catch (error) {
    if (seen === null) throw error; // never reached the fetch: a rejected filter
  }
  return new URL(seen as unknown as string).searchParams;
}

describe('genres and magazines', () => {
  // MAL ANDs multiple ids rather than ORing them: on "love", genre 12 returns 16 results and genre
  // 49 returns 3, but both together return 0.
  it('sends one genre[] per id, which MyAnimeList treats as "must have all"', async () => {
    const q = await params({ genres: '1,46' });
    expect(q.getAll('genre[]')).toEqual(['1', '46']);
  });

  it('refuses a genre list that is not ids', async () => {
    await expect(params({ genres: 'action' })).rejects.toThrow(/positive genre ids/);
  });

  // The exclude flag was shipped earlier today and did not work: with gx=1 set, 16 of 18 results
  // were the same entries the plain filter returns. It is refused now rather than faked.
  it('no longer sends the exclude flag, which MyAnimeList ignores', async () => {
    const q = await params({ genres: '12' });
    expect(q.get('gx')).toBeNull();
  });
});

describe('date filters', () => {
  // MAL's advanced search splits each bound into three selects, month first: sm/sd/sy for the
  // start bound, em/ed/ey for the end one.
  it('maps YYYY-MM-DD onto the three selects MAL uses, in the right order', async () => {
    const q = await params({ startDate: '2015-01-02', endDate: '2020-12-31' });
    expect([q.get('sm'), q.get('sd'), q.get('sy')]).toEqual(['1', '2', '2015']);
    expect([q.get('em'), q.get('ed'), q.get('ey')]).toEqual(['12', '31', '2020']);
  });

  it("drops the leading zero, which is not what MAL's option values look like", async () => {
    const q = await params({ startDate: '2015-01-05' });
    expect(q.get('sm')).toBe('1');
    expect(q.get('sd')).toBe('5');
  });

  it('sends nothing when neither bound is given', async () => {
    const q = await params({});
    for (const key of ['sm', 'sd', 'sy', 'em', 'ed', 'ey']) expect(q.get(key)).toBeNull();
  });

  it.each(['2015', '2015-1-2', '15-01-02', 'yesterday', '2015/01/02'])(
    'refuses %j rather than guessing at it',
    async (value) => {
      await expect(params({ startDate: value })).rejects.toThrow(/YYYY-MM-DD/);
    },
  );

  it('refuses a date that could never exist', async () => {
    await expect(params({ startDate: '2015-13-01' })).rejects.toThrow(/not a real date/);
    await expect(params({ endDate: '2015-01-32' })).rejects.toThrow(/not a real date/);
  });
});
