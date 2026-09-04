import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CatalogSource } from '../../src/ports/driven/catalog-source.port';
import { applyD1Migrations, env } from 'cloudflare:test';
import { ProducerService } from '../../src/services/producer.service';
import { CharacterService } from '../../src/services/character.service';
import { PersonService } from '../../src/services/person.service';
import type { RuntimeConfig } from '../../src/config/env';
import type { SourceResult } from '../../src/source/source-types';

const bindings = env as unknown as { DB: D1Database; TEST_MIGRATIONS: import('cloudflare:test').D1Migration[] };
const config: RuntimeConfig = { profileTtlSeconds: 60, listTtlSeconds: 60, animeTtlSeconds: 3_600, catalogTtlSeconds: 3_600, sourceTimeoutMs: 1_000, maxUpstreamBytes: 2_000_000, malUserAgent: 'test' };

// Inlined rather than read from tests/fixtures/**/full-valid.html: the Workers pool runs this file
// in a bundled sandbox where readFileSync can't resolve a relative repo path — every file under
// tests/integration/ inlines its fixtures for the same reason. Same content as the parser fixtures.
const producerHtml = `<!doctype html><html><head><title>Studio Pierrot - MyAnimeList.net</title></head><body>
<img class="lazyload" data-src="https://cdn.myanimelist.net/s/common/company_logos/a0524dfa-5a6d-40a7-8a1e-233e3822acb5_600x600_i?s=48123c150ab3365033f471461a50acc6" alt="Studio Pierrot">
<h1 class="title-name">Studio Pierrot</h1>
<div class="spaceit_pad"> <span class="dark_text">Established:</span> May, 1979 </div>
<div class="spaceit_pad"> <span class="dark_text">Member Favorites:</span> 6,417 </div>
<div class="spaceit_pad"><span>Pierrot is a Japanese animation studio established in May 1979.</span></div>
<h2>Available At</h2>
<div class="user-profile-sns mb16"><span><i class="icon-sns fa-solid fa-fw fa-link"></i><a href="http://pierrot.jp/" target="_blank" rel="noreferrer">pierrot.jp</a><br><a href="https://www.facebook.com/studiopierrot" target="_blank" rel="noreferrer">Facebook</a><br></span></div>
<h2>Resources</h2>
<div class="pb16"><span><a href="https://ja.wikipedia.org/wiki/x" target="_blank" rel="noreferrer">ja.wikipedia.org</a></span></div>
<div class="content-right">next section</div>
</body></html>`;

const characterHtml = `<!doctype html><html><head><title>Spike Spiegel - MyAnimeList.net</title></head><body>
<h1 class="title-name h1_bold_none"><strong>Spike Spiegel</strong></h1>
<img class="portrait-225x350 lazyload" data-src="https://cdn.myanimelist.net/images/characters/11/516853.jpg" alt="Spike Spiegel">
<br /><br />
Member Favorites: 49,189
<h2 class="normal_header" style="height: 15px;">Spike Spiegel <span style="font-weight: normal;"><small>(スパイク・スピーゲル)</small></span></h2>Birthdate: June 26, 2044<br />
Height: 185 cm<br />
Spike Spiegel is a tall and lean bounty hunter born on Mars.
<div class="normal_header character-anime">Animeography</div>
<table border="0" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td width="25" class="borderClass" valign="top"><div class="picSurround"><a href="https://myanimelist.net/anime/1/Cowboy_Bebop"><img class="lazyload" data-src="https://cdn.myanimelist.net/r/42x62/images/anime/4/19644.jpg?s=42d7666179a2851c99fada2e0ceb5da1" border="0"></a></div></td>
<td valign="top" class="borderClass"><a href="https://myanimelist.net/anime/1/Cowboy_Bebop">Cowboy Bebop</a>
<div class="spaceit_pad"><small>Main</small></div></td>
</tr>
</table>
<div class="normal_header character-manga">Mangaography</div>
<table border="0" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td width="25" class="borderClass" valign="top"><div class="picSurround"><a href="https://myanimelist.net/manga/173/Cowboy_Bebop"><img class="lazyload" data-src="https://cdn.myanimelist.net/r/42x62/images/manga/3/166652.jpg?s=11de80d1d5c75e063332dbe842bf" border="0"></a></div></td>
<td valign="top" class="borderClass"><a href="https://myanimelist.net/manga/173/Cowboy_Bebop">Cowboy Bebop</a>
<div class="spaceit_pad"><small>Main</small></div></td>
</tr>
</table>
<div class="normal_header">Voice Actors</div>
<table border="0" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td class="borderClass" valign="top" width="46"><div class="picSurround"><a href="https://myanimelist.net/people/11/Kouichi_Yamadera"><img class="lazyload" data-src="https://cdn.myanimelist.net/images/voiceactors/1/23960.jpg" border="0" width="42"></a></div></td>
<td class="borderClass" valign="top"><a href="https://myanimelist.net/people/11/Kouichi_Yamadera">Yamadera, Kouichi</a>
<div style="margin-top: 2px;"><small>Japanese</small></div></td>
</tr>
</table>
</body></html>`;

const personHtml = `<!doctype html><html><head><title>Yamadera, Kouichi - MyAnimeList.net</title></head><body>
<h1 class="title-name h1_bold_none"><strong>Yamadera, Kouichi</strong></h1>
<img class="lazyload" data-src="https://cdn.myanimelist.net/images/voiceactors/2/73614.jpg" alt="Yamadera, Kouichi">
<div class="spaceit_pad"><span class="dark_text">Given name:</span> 宏一</div>
<span class="dark_text">Family name:</span> 山寺<div class="spaceit_pad"><span class="dark_text">Alternate names:</span> Koichi Yamadera</div>
<div class="spaceit_pad"><span class="dark_text">Birthday:</span> Jun 17, 1961</div>
<div class="spaceit_pad"><span class="dark_text">Member Favorites:</span> 1,615</div>
<div class="normal_header"><h2 class="h2_overwrite">Voice Acting Roles</h2></div>
<table border="0" cellpadding="0" cellspacing="0" width="100%" class="js-table-people-character" style="display: none;">
<tr class="js-people-character js-anime-watch-status-people-va-notinmylist">
  <td valign="top" class="borderClass" width="25"><div class="picSurround"><a href="https://myanimelist.net/anime/1/Cowboy_Bebop"><img data-src="https://cdn.myanimelist.net/r/84x124/images/anime/4/19644.jpg?s=42d7666179a2851c99fada2e0ceb5da1" border="0" width="42" class="lazyload"></a></div></td>
  <td valign="top" class="borderClass"><div class="spaceit_pad"><a href="https://myanimelist.net/anime/1/Cowboy_Bebop" class="js-people-title">Cowboy Bebop</a></div><div class="spaceit_pad anime-info-text">TV, Spring 1998</div></td>
  <td valign="top" class="borderClass" align="right" nowrap><div class="spaceit_pad"><a href="https://myanimelist.net/character/1/Spike_Spiegel">Spiegel, Spike</a>&nbsp;</div><div class="spaceit_pad">Main&nbsp;</div><div class="spaceit_pad character-total-favorites">49189 Favorites&nbsp;</div></td>
  <td valign="top" class="borderClass" width="25"><div class="picSurround"><a href="https://myanimelist.net/character/1/Spike_Spiegel"><img data-src="https://cdn.myanimelist.net/r/84x124/images/characters/11/516853.jpg" border="0" width="42" class="lazyload"></a></div></td>
</tr>
</table>
<div class="normal_header">Anime Staff Positions</div>
<table border="0" cellpadding="0" cellspacing="0" width="100%" class="js-table-people-staff" style="display: none;">
</table>
<div class="normal_header">Published Manga</div>
<table border="0" cellpadding="0" cellspacing="0" width="100%" class="js-table-people-manga" style="display: none;">
</table>
</body></html>`;

function stubSource(calls: { count: number }, html: string): CatalogSource {
  return {
    getHtml: async (url: string): Promise<SourceResult<string>> => {
      calls.count += 1;
      return { kind: 'success', value: html, metadata: { url, status: 200, contentType: 'text/html', durationMs: 1, sizeBytes: html.length } };
    },
  };
}

beforeAll(async () => applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS));
beforeEach(async () => { for (const table of ['producers', 'characters', 'people', 'catalog_lists', 'cache_entries', 'refresh_leases']) await bindings.DB.prepare(`DELETE FROM ${table}`).run(); });

describe('ProducerService: detail() and full() share one upstream fetch on a cold cache', () => {
  it('detail() priming lets a following full() call skip its own fetch', async () => {
    const calls = { count: 0 };
    const service = new ProducerService(bindings.DB, config, stubSource(calls, producerHtml));
    await service.detail('1', 'req-1');
    expect(calls.count).toBe(1);
    const full = await service.full('1', 'req-2');
    expect(calls.count).toBe(1);
    expect(full.cached).toBe(true);
    expect(full.data.about).toContain('Pierrot');
  });

  it('full() priming lets a following detail() call skip its own fetch, without leaking about/external', async () => {
    const calls = { count: 0 };
    const service = new ProducerService(bindings.DB, config, stubSource(calls, producerHtml));
    await service.full('1', 'req-1');
    expect(calls.count).toBe(1);
    const detail = await service.detail('1', 'req-2');
    expect(calls.count).toBe(1);
    expect(detail.cached).toBe(true);
    const raw = detail.data as unknown as Record<string, unknown>;
    expect(raw.about).toBeUndefined();
    expect(raw.external).toBeUndefined();
  });
});

// The 3-way case: detail(), full() and media() (behind anime()/manga()/voices()) all read the same
// page. Whichever refreshes first should prime the other two, so hitting all three close together
// (a realistic client pattern) costs exactly one upstream fetch, not up to three.
describe('CharacterService: detail(), full() and voices() share one upstream fetch', () => {
  it('detail() priming lets full() and voices() both skip their own fetch', async () => {
    const calls = { count: 0 };
    const service = new CharacterService(bindings.DB, config, stubSource(calls, characterHtml));
    await service.detail('1', 'req-1');
    expect(calls.count).toBe(1);
    const full = await service.full('1', 'req-2');
    expect(calls.count).toBe(1);
    expect(full.cached).toBe(true);
    const voices = await service.voices('1', 'req-3');
    expect(calls.count).toBe(1);
    expect(voices.data.length).toBeGreaterThan(0);
  });

  it('full() priming lets detail() and voices() both skip their own fetch, without leaking media fields', async () => {
    const calls = { count: 0 };
    const service = new CharacterService(bindings.DB, config, stubSource(calls, characterHtml));
    await service.full('1', 'req-1');
    expect(calls.count).toBe(1);
    const detail = await service.detail('1', 'req-2');
    expect(calls.count).toBe(1);
    const raw = detail.data as unknown as Record<string, unknown>;
    expect(raw.anime).toBeUndefined();
    expect(raw.voices).toBeUndefined();
    const voices = await service.voices('1', 'req-3');
    expect(calls.count).toBe(1);
    expect(voices.data.length).toBeGreaterThan(0);
  });

  it('voices() priming lets detail() and full() both skip their own fetch', async () => {
    const calls = { count: 0 };
    const service = new CharacterService(bindings.DB, config, stubSource(calls, characterHtml));
    await service.voices('1', 'req-1');
    expect(calls.count).toBe(1);
    await service.detail('1', 'req-2');
    expect(calls.count).toBe(1);
    await service.full('1', 'req-3');
    expect(calls.count).toBe(1);
  });
});

describe('PersonService: detail(), full() and voices() share one upstream fetch', () => {
  it('detail() priming lets full() and voices() both skip their own fetch', async () => {
    const calls = { count: 0 };
    const service = new PersonService(bindings.DB, config, stubSource(calls, personHtml));
    await service.detail('1', 'req-1');
    expect(calls.count).toBe(1);
    const full = await service.full('1', 'req-2');
    expect(calls.count).toBe(1);
    expect(full.cached).toBe(true);
    const voices = await service.voices('1', 'req-3');
    expect(calls.count).toBe(1);
    expect(voices.data.length).toBeGreaterThan(0);
  });

  it('full() priming lets detail() and voices() both skip their own fetch, without leaking media fields', async () => {
    const calls = { count: 0 };
    const service = new PersonService(bindings.DB, config, stubSource(calls, personHtml));
    await service.full('1', 'req-1');
    expect(calls.count).toBe(1);
    const detail = await service.detail('1', 'req-2');
    expect(calls.count).toBe(1);
    const raw = detail.data as unknown as Record<string, unknown>;
    expect(raw.anime).toBeUndefined();
    expect(raw.voices).toBeUndefined();
    const voices = await service.voices('1', 'req-3');
    expect(calls.count).toBe(1);
    expect(voices.data.length).toBeGreaterThan(0);
  });
});
