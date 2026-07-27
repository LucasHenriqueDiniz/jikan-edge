import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUserProfile } from '../../src/parsers/user-profile.parser';
import { parseAnimeDetail } from '../../src/parsers/anime-detail.parser';
import { parseTopAnime } from '../../src/parsers/top-anime.parser';
import { parseSeasonNow } from '../../src/parsers/season-now.parser';
import { parseMangaDetail } from '../../src/parsers/manga-detail.parser';
import { parseTopManga } from '../../src/parsers/top-manga.parser';
import { parseCharacterDetail } from '../../src/parsers/character-detail.parser';
import { parseProducerDetail } from '../../src/parsers/producer-detail.parser';
import { parseClubDetail } from '../../src/parsers/club-detail.parser';
import { parsePersonDetail } from '../../src/parsers/person-detail.parser';
import { parseReviews } from '../../src/parsers/reviews.parser';
import { parseSearchResults } from '../../src/parsers/search.parser';
import { parseCharacters, parseStaff } from '../../src/parsers/characters-staff.parser';
import { parseStatistics } from '../../src/parsers/statistics.parser';
import { parsePictures } from '../../src/parsers/pictures.parser';
import { parseNews } from '../../src/parsers/news.parser';
import { parseForum } from '../../src/parsers/forum.parser';
import { parseEpisodes } from '../../src/parsers/episodes.parser';
import { parseClubMembers } from '../../src/parsers/club-members.parser';
import { parseUserSearch } from '../../src/parsers/user-search.parser';
import { parseClubList } from '../../src/parsers/club-list.parser';
import { parseProducerFull } from '../../src/parsers/producer-full.parser';
import { parseCharacterSearch } from '../../src/parsers/character-search.parser';
import { parsePersonSearch } from '../../src/parsers/person-search.parser';
import { parseAnimeFull } from '../../src/parsers/anime-full.parser';
import { parseCharacterAnimeography, parseCharacterMangaography, parseCharacterVoiceActors } from '../../src/parsers/character-media.parser';
import { parsePersonAnimeStaff, parsePersonManga, parsePersonVoiceActingRoles } from '../../src/parsers/person-media.parser';
import { parseCharacterFull } from '../../src/parsers/character-full.parser';
import { parsePersonFull } from '../../src/parsers/person-full.parser';
import { parseTopPeople } from '../../src/parsers/top-people.parser';
import { parseTopCharacters } from '../../src/parsers/top-characters.parser';
import { parseTitleReviews } from '../../src/parsers/title-reviews.parser';
import { parseTitleRecommendations } from '../../src/parsers/title-recommendations.parser';
import { parseMoreInfo } from '../../src/parsers/more-info.parser';

describe('parser benchmark smoke test', () => {
  it('reports a bounded fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/users/profile-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseUserProfile(html, 'amayacrab'); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'user-profile-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded anime-detail fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/anime/detail-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseAnimeDetail(html, 1); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'anime-detail-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded top-anime fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/anime/top-anime-page1.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseTopAnime(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'top-anime-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded season-now fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/anime/season-now-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseSeasonNow(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'season-now-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded manga-detail fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/manga/detail-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseMangaDetail(html, 2); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'manga-detail-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded top-manga fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/manga/top-manga-page1.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseTopManga(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'top-manga-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded character-detail fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/characters/detail-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseCharacterDetail(html, 1); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'character-detail-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded producer-detail fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/producers/detail-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseProducerDetail(html, 123); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'producer-detail-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded club-detail fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/clubs/detail-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseClubDetail(html, 1); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'club-detail-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded person-detail fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/people/detail-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parsePersonDetail(html, 11); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'person-detail-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded reviews fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/reviews/anime-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseReviews(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'reviews-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded search fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/search/anime-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseSearchResults(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'search-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded characters/staff fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/characters/anime-characters-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseCharacters(html, 'anime'); parseStaff(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'characters-staff-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded statistics fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/statistics/anime-stats-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseStatistics(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'statistics-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded pictures fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/pictures/anime-pics-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parsePictures(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'pictures-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded news fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/news/anime-news-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseNews(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'news-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded forum fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/forum/anime-forum-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseForum(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'forum-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded episodes fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/episodes/anime-episodes-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseEpisodes(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'episodes-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded user-search fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/users/search-list-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseUserSearch(html, 'amaya'); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'user-search-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded club-list fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/clubs/index-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseClubList(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'club-list-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded producer-full fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/producers/full-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseProducerFull(html, 1); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'producer-full-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded character-search fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/characters/search-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseCharacterSearch(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'character-search-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded person-search fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/people/search-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parsePersonSearch(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'person-search-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded anime-full fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/anime/full-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseAnimeFull(html, 1); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'anime-full-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded character-media fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/characters/media-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseCharacterAnimeography(html); parseCharacterMangaography(html); parseCharacterVoiceActors(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'character-media-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded person-media fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/people/media-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parsePersonAnimeStaff(html); parsePersonManga(html); parsePersonVoiceActingRoles(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'person-media-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded character-full fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/characters/full-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseCharacterFull(html, 1); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'character-full-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded person-full fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/people/full-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parsePersonFull(html, 11); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'person-full-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded top-people fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/people/top-people-page1.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseTopPeople(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'top-people-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded top-characters fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/characters/top-characters-page1.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseTopCharacters(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'top-characters-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded title-reviews fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/reviews/anime-title-reviews-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseTitleReviews(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'title-reviews-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded title-recommendations fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/recommendations/anime-title-recs-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseTitleRecommendations(html, 'anime'); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'title-recommendations-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded more-info fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/anime/moreinfo-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseMoreInfo(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'more-info-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });

  it('reports a bounded club-members fixture parsing duration', () => {
    const html = readFileSync('tests/fixtures/clubs/members-valid.html', 'utf8'); const samples: number[] = [];
    for (let index = 0; index < 100; index += 1) { const started = performance.now(); parseClubMembers(html); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(JSON.stringify({ benchmark: 'club-members-fixture', min: samples[0], p50: samples[50], p95, max: samples.at(-1), failures: 0 }));
    expect(p95).toBeLessThan(8);
  });
});
