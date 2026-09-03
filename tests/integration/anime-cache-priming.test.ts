import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CatalogSource } from '../../src/ports/driven/catalog-source.port';
import { applyD1Migrations, env } from 'cloudflare:test';
import { AnimeService } from '../../src/services/anime.service';
import type { RuntimeConfig } from '../../src/config/env';
import type { SourceResult } from '../../src/source/source-types';

const bindings = env as unknown as { DB: D1Database; TEST_MIGRATIONS: import('cloudflare:test').D1Migration[] };
const config: RuntimeConfig = { profileTtlSeconds: 60, listTtlSeconds: 60, animeTtlSeconds: 3_600, catalogTtlSeconds: 3_600, sourceTimeoutMs: 1_000, maxUpstreamBytes: 2_000_000, malUserAgent: 'test' };

// Inlined rather than read from tests/fixtures/anime/full-valid.html: the Workers pool runs this
// file in a bundled sandbox where readFileSync can't resolve a relative repo path (confirmed —
// every other file under tests/integration/ inlines its fixtures for the same reason). Same
// content as that fixture, minimal detail fields plus one opening/two endings.
const html = `<!doctype html><html><head><title>Cowboy Bebop - MyAnimeList.net</title></head><body>
<h1 class="title-name h1_bold_none"><strong>Cowboy Bebop</strong></h1>
<img class="lazyloaded" data-src="https://cdn.myanimelist.net/images/anime/4/19644.jpg" alt="Cowboy Bebop" itemprop="image" src="https://cdn.myanimelist.net/images/anime/4/19644.jpg">
<p itemprop="description">Crime is timeless. Spike and Jet chase bounties across the solar system.</p>
<div class="spaceit_pad"> <span class="dark_text">Japanese:</span> カウボーイビバップ </div>
<div class="spaceit_pad"> <span class="dark_text">English:</span> Cowboy Bebop </div>
<div class="spaceit_pad"> <span class="dark_text">Type:</span> <a href="/topanime.php?type=tv">TV</a> </div>
<div class="spaceit_pad"> <span class="dark_text">Episodes:</span> 26 </div>
<div class="spaceit_pad"> <span class="dark_text">Status:</span> Finished Airing </div>
<div class="spaceit_pad"> <span class="dark_text">Aired:</span> Apr 3, 1998 to Apr 24, 1999 </div>
<div class="spaceit_pad"> <span class="dark_text">Studios:</span> <a href="/anime/producer/14/Sunrise" title="Sunrise">Sunrise</a> </div>
<div class="spaceit_pad"> <span class="dark_text">Source:</span> Original </div>
<div class="spaceit_pad"> <span class="dark_text">Genres:</span> <a href="/anime/genre/1/Action" title="Action">Action</a>, <a href="/anime/genre/46/Award_Winning" title="Award Winning">Award Winning</a> </div>
<div class="spaceit_pad"> <span class="dark_text">Themes:</span> <a href="/anime/genre/50/Adult_Cast" title="Adult Cast">Adult Cast</a>, <a href="/anime/genre/29/Space" title="Space">Space</a> </div>
<div class="spaceit_pad"> <span class="dark_text">Duration:</span> 24 min. per ep. </div>
<div class="spaceit_pad"> <span class="dark_text">Rating:</span> R - 17+ (violence &amp; profanity) </div>
<div class="spaceit_pad"> <span class="dark_text">Score:</span> <span itemprop="ratingValue" class="score-label score-8">8.75</span> </div>
<div class="spaceit_pad"> <span class="dark_text">Ranked:</span> #50 </div>
<div class="spaceit_pad"> <span class="dark_text">Popularity:</span> #41 </div>
<div class="spaceit_pad"> <span class="dark_text">Members:</span> 2,074,721 </div>
<div class="spaceit_pad"> <span class="dark_text">Favorites:</span> 90,366 </div>
<div>
  <a href="https://myanimelist.net/dbchanges.php?aid=1&amp;t=theme&amp;themetype=1" class="floatRightHeader">Edit</a>
  <h2>Opening Theme</h2>
</div>
<div class="theme-songs js-theme-songs opnening">
  <table border="0" width="100%"><tr><td width="8%"><div class="oped-preview-button"></div></td>
  <td width="84%"><a href="javascript:openMusicLinkPopup('25957', 'Tank\\x21', 'The\\x20Seatbelts', '2VqRxxZFbC0uZaTJcZY36c');"><span class="theme-song-title">"Tank!"</span></a><span class="theme-song-artist"> by The Seatbelts</span>&nbsp;<span class="theme-song-episode">(eps 1-25)</span></td>
  <td width="8%"></td></tr></table>
</div>
<div>
  <a href="https://myanimelist.net/dbchanges.php?aid=1&amp;t=theme&amp;themetype=2" class="floatRightHeader">Edit</a>
  <h2>Ending Theme</h2>
</div>
<div class="theme-songs js-theme-songs ending">
  <table border="0" width="100%"><tr><td width="8%"><div class="oped-preview-button"></div></td>
  <td width="84%"><span class="theme-song-index">1:</span>&nbsp;<a href="javascript:openMusicLinkPopup('310', 'x', 'y', 'z');"><span class="theme-song-title">"The Real Folk Blues"</span></a><span class="theme-song-artist"> by The Seatbelts feat. Mai Yamane</span>&nbsp;<span class="theme-song-episode">(eps  1-12, 14-25)</span></td>
  <td width="8%"></td></tr>
  <tr><td width="8%"><div class="oped-preview-button"></div></td>
  <td width="84%"><span class="theme-song-index">2:</span>&nbsp;<a href="javascript:openMusicLinkPopup('311', 'x', 'y', 'z');"><span class="theme-song-title">"Space Lion"</span></a><span class="theme-song-artist"> by The Seatbelts</span>&nbsp;<span class="theme-song-episode">(eps 13)</span></td>
  <td width="8%"></td></tr></table>
</div>
<h2>Reviews</h2>
<div id="broadcast-block"><a class="js-broadcast-button" data-raw='{"data":[{"platform":{"id":1,"name":"Crunchyroll","icon":"crunchyroll","type":1},"available":true,"url":"http:\\/\\/www.crunchyroll.com\\/series-271225"}]}'></a></div>
<br /><h2>Available At</h2><div class="external_links"><a href="http://www.cowboy-bebop.net/" target="_blank" class="link ga-click" data-ga-click-type="external-links-anime-pc-official-site"><i class="link_icon fas fa-link"></i><div class="caption">Official Site</div></a></div>
</body></html>`;

function stubSource(calls: { count: number }): CatalogSource {
  return {
    getHtml: async (url: string): Promise<SourceResult<string>> => {
      calls.count += 1;
      return { kind: 'success', value: html, metadata: { url, status: 200, contentType: 'text/html', durationMs: 1, sizeBytes: html.length } };
    },
  };
}

beforeAll(async () => applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS));
beforeEach(async () => { for (const table of ['anime', 'catalog_lists', 'cache_entries', 'refresh_leases']) await bindings.DB.prepare(`DELETE FROM ${table}`).run(); });

// detail() and full() both read animeDetailUrl(malId) — the exact same MAL page. Before this fix,
// each managed its own cache independently, so calling both close together (a realistic pattern:
// a client wanting base fields plus theme songs) meant two real upstream fetches for one page.
describe('AnimeService: detail() and full() share one upstream fetch on a cold cache', () => {
  it('detail() priming the cache lets a following full() call skip its own fetch', async () => {
    const calls = { count: 0 };
    const service = new AnimeService(bindings.DB, config, stubSource(calls));

    const detailResult = await service.detail('1', 'req-1');
    expect(calls.count).toBe(1);
    expect(detailResult.cached).toBe(false);

    const fullResult = await service.full('1', 'req-2');
    expect(calls.count).toBe(1); // still 1 — full() found the row detail() primed, already fresh
    expect(fullResult.cached).toBe(true);
    expect(fullResult.data.themeSongs.openings.length).toBeGreaterThan(0);
  });

  it('full() priming the cache lets a following detail() call skip its own fetch, without leaking themeSongs', async () => {
    const calls = { count: 0 };
    const service = new AnimeService(bindings.DB, config, stubSource(calls));

    const fullResult = await service.full('1', 'req-1');
    expect(calls.count).toBe(1);
    expect(fullResult.cached).toBe(false);

    const detailResult = await service.detail('1', 'req-2');
    expect(calls.count).toBe(1); // still 1 — detail() found the row full() primed, already fresh
    expect(detailResult.cached).toBe(true);
    expect((detailResult.data as unknown as Record<string, unknown>).themeSongs).toBeUndefined();
  });
});
