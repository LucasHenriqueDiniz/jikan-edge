import { describe, expect, it } from 'vitest';
import { parseProducersList } from '../../src/parsers/producers-list.parser';
import { parseSeasonArchive } from '../../src/parsers/season-archive.parser';
import { parseTitleVideos } from '../../src/parsers/videos.parser';
import { parseEpisodeDetail } from '../../src/parsers/episode-detail.parser';
import { parseTitleUserUpdates } from '../../src/parsers/title-userupdates.parser';
import { parseClubRelations } from '../../src/parsers/club-relations.parser';

describe('producers list parser', () => {
  function buildDirectory(count: number): string {
    const entries = Array.from(
      { length: count },
      (_, index) =>
        `<a href="/anime/producer/${index + 1}/P_${index + 1}" class="genre-name-link">Producer ${index + 1} (${index + 1})</a>`,
    ).join('\n');
    return `<html><body>${entries}</body></html>`;
  }

  it('extracts a large producer directory', () => {
    const producers = parseProducersList(buildDirectory(400));
    expect(producers).toHaveLength(400);
    expect(producers[0]).toEqual({
      malId: 1,
      name: 'Producer 1',
      count: 1,
      url: 'https://myanimelist.net/anime/producer/1',
    });
  });

  it('rejects an implausibly short directory', () => {
    expect(() => parseProducersList(buildDirectory(10))).toThrow('invalid_producer_list');
  });
});

describe('season archive parser', () => {
  function buildArchive(years: number): string {
    const links = [];
    for (let year = 2026; year > 2026 - years; year -= 1) {
      for (const season of ['winter', 'spring', 'summer', 'fall'])
        links.push(`<a href="https://myanimelist.net/anime/season/${year}/${season}">${season} ${year}</a>`);
    }
    return `<html><body>${links.join('\n')}</body></html>`;
  }

  it('groups seasons by year, newest first', () => {
    const archive = parseSeasonArchive(buildArchive(40));
    expect(archive[0]).toEqual({ year: 2026, seasons: ['winter', 'spring', 'summer', 'fall'] });
    expect(archive.length).toBe(40);
    expect(archive[0].year).toBeGreaterThan(archive[1].year);
  });

  it('rejects an implausibly short archive', () => {
    expect(() => parseSeasonArchive(buildArchive(3))).toThrow('invalid_season_archive');
  });
});

describe('title videos parser', () => {
  const html = `<html><body>
    <h2>Episodes</h2>
    <div><a class="video-list di-ib po-r" href="https://myanimelist.net/anime/1/Cowboy_Bebop/episode/26"><img data-src="https://cdn.myanimelist.net/thumb26.jpg" data-title="The&#x20;Real&#x20;Folk&#x20;Blues" data-video-id="1" data-anime-id="1"></a></div>
    <h2 class="h2_overwrite">Music Videos</h2>
    <section><div class="video-list-outer po-r pv"><a class="iframe js-fancybox-video video-list di-ib po-r" href="https://www.youtube-nocookie.com/embed/mv1"><img data-src="https://cdn.myanimelist.net/mv.jpg" data-title="MV&#x20;1"></a></div></section>
    <h2 class="h2_overwrite">Trailers</h2>
    <section><div class="video-list-outer po-r pv"><a class="iframe js-fancybox-video video-list di-ib po-r" href="https://www.youtube-nocookie.com/embed/pv1"><img data-src="https://cdn.myanimelist.net/pv.jpg" data-title="PV&#x20;1"></a></div></section>
  </body></html>`;

  it('extracts episodes, music videos, and trailers into separate buckets', () => {
    const videos = parseTitleVideos(html);
    expect(videos.episodes).toEqual([
      {
        episode: 26,
        title: 'The Real Folk Blues',
        url: 'https://myanimelist.net/anime/1/Cowboy_Bebop/episode/26',
        imageUrl: 'https://cdn.myanimelist.net/thumb26.jpg',
      },
    ]);
    expect(videos.musicVideos).toEqual([
      {
        title: 'MV 1',
        videoUrl: 'https://www.youtube-nocookie.com/embed/mv1',
        imageUrl: 'https://cdn.myanimelist.net/mv.jpg',
      },
    ]);
    expect(videos.promos).toEqual([
      {
        title: 'PV 1',
        videoUrl: 'https://www.youtube-nocookie.com/embed/pv1',
        imageUrl: 'https://cdn.myanimelist.net/pv.jpg',
      },
    ]);
  });
});

describe('episode detail parser', () => {
  const html = `<html><body>
    <h2 class="fs18 lh11" style="x"><span class="fw-n">#1 - </span>Asteroid Blues</h2>
    <p class="fn-grey2" style="y">Asteroid Blues (アステロイド・ブルース)</p>
    <span class="fw-b">Duration: </span>00:24:00<br><span class="fw-b">Aired: </span>Oct 24, 1998(JST)</div>
    <h2 class="fw-b">Synopsis</h2>
    In a flashback, Spike Spiegel is shown waiting near a church.
    <div class="next"></div>
  </body></html>`;

  it('extracts title, alt title, duration, aired, and synopsis', () => {
    const detail = parseEpisodeDetail(html, 1, 1);
    expect(detail).toEqual({
      malId: 1,
      episode: 1,
      title: 'Asteroid Blues',
      titleAlternative: 'Asteroid Blues (アステロイド・ブルース)',
      duration: '00:24:00',
      aired: 'Oct 24, 1998(JST)',
      synopsis: 'In a flashback, Spike Spiegel is shown waiting near a church.',
    });
  });
});

describe('title userupdates parser', () => {
  const html = `<html><body><table>
    <tr><td class="borderClass"><div class="di-tc" style="width:30px;"><a href="https://myanimelist.net/profile/Lifalya" style="background-image:url(https://cdn.myanimelist.net/images/userimages/1.jpg)" class="image-member"></a></div><div class="di-tc va-m al pl4"><a href="https://myanimelist.net/profile/Lifalya" class="word-break">Lifalya</a></div></td><td class="borderClass ac">-</td><td class="borderClass ac">Watching</td><td class="borderClass ac">18 / 26</td><td class="borderClass ac">5 hours ago</td></tr>
    <tr><td class="borderClass"><div class="di-tc" style="width:30px;"><a href="https://myanimelist.net/profile/Zed" style="background-image:url(https://cdn.myanimelist.net/images/kaomoji_mal_white.png)" class="image-member"></a></div><div class="di-tc va-m al pl4"><a href="https://myanimelist.net/profile/Zed" class="word-break">Zed</a></div></td><td class="borderClass ac">8</td><td class="borderClass ac">Completed</td><td class="borderClass ac"></td><td class="borderClass ac">6 hours ago</td></tr>
  </table></body></html>`;

  it('extracts member update rows from the stats page', () => {
    const updates = parseTitleUserUpdates(html);
    expect(updates).toHaveLength(2);
    expect(updates[0]).toEqual({
      username: 'Lifalya',
      imageUrl: 'https://cdn.myanimelist.net/images/userimages/1.jpg',
      score: null,
      status: 'Watching',
      progress: 18,
      total: 26,
      date: '5 hours ago',
    });
    expect(updates[1]).toMatchObject({
      username: 'Zed',
      imageUrl: null,
      score: 8,
      status: 'Completed',
      progress: null,
      total: null,
    });
  });
});

describe('club relations parser', () => {
  const html = `<html><body>
    <div class="normal_header">Anime Relations</div><div class="borderClass"><a href="anime/1">Cowboy Bebop</a></div>
    <div class="normal_header">Manga Relations</div><div class="borderClass"><a href="manga/173">Cowboy Bebop</a></div>
    <div class="normal_header">Character Relations</div><div class="borderClass"><a href="character/1">Spike Spiegel</a></div><div class="borderClass"><a href="character/2">Faye Valentine</a></div>
  </body></html>`;

  it('extracts anime/manga/character relations', () => {
    const relations = parseClubRelations(html);
    expect(relations.anime).toEqual([{ malId: 1, title: 'Cowboy Bebop' }]);
    expect(relations.manga).toEqual([{ malId: 173, title: 'Cowboy Bebop' }]);
    expect(relations.characters).toEqual([
      { malId: 1, name: 'Spike Spiegel' },
      { malId: 2, name: 'Faye Valentine' },
    ]);
  });

  it('returns empty lists when the club has no relation sections', () => {
    expect(parseClubRelations('<html><body>nothing</body></html>')).toEqual({ anime: [], manga: [], characters: [] });
  });
});
