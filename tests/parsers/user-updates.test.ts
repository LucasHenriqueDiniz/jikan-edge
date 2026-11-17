import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUserUpdates } from '../../src/parsers/user-updates.parser';

// A byte-exact capture of a real profile. Each entry nests `data` > `graph-content`, and the progress
// line comes after `graph-content` closes — the old block bound stopped there, so progress, total and
// score were null on every entry of every profile while nothing tested this parser at all.
const realHtml = readFileSync('tests/fixtures/users/profile-real.html', 'utf8');

const row = (update: { status: string; progress: number | null; total: number | null; score: number | null }) => ({
  status: update.status,
  progress: update.progress,
  total: update.total,
  score: update.score,
});

describe('user updates parser, against a real profile', () => {
  const updates = parseUserUpdates(realHtml);

  it('reads progress, total and score of every anime entry', () => {
    expect(updates.anime.map(row)).toEqual([
      { status: 'completed', progress: 13, total: 13, score: 6 },
      { status: 'completed', progress: 20, total: 20, score: 7 },
      { status: 'completed', progress: 12, total: 12, score: 5 },
    ]);
    expect(updates.anime[0]?.entry).toMatchObject({
      malId: 58567,
      title: 'Ore dake Level Up na Ken Season 2: Arise from the Shadow',
    });
  });

  it('keeps an unknown total and a missing score as null, not as the next number on the page', () => {
    expect(updates.manga.map(row)).toEqual([
      { status: 'reading', progress: 12, total: null, score: 7 },
      { status: 'completed', progress: 47, total: 47, score: 7 },
      { status: 'on hold', progress: 100, total: null, score: null },
    ]);
  });
});

// Real entries, copied byte for byte from two live profiles on 2026-11-16 and put in a manga section.
const SEA_GUARDIAN = `<div class="statistics-updates di-b w100 mb8">
  <a href="https://myanimelist.net/manga/182795/I_Became_the_Sea_Guardians_Adopted_Daughter" class="fl-l di-ib mr8 image">
    <img class="lazyload" data-src="https://cdn.myanimelist.net/r/80x120/images/manga/1/327161.jpg?s=9fee85917c4fcf45066c107a4d2f0b24" width="40" alt="I Became the Sea Guardian&#039;s Adopted Daughter">
  </a>


  <div class="data">
    <a href="https://myanimelist.net/manga/182795/I_Became_the_Sea_Guardians_Adopted_Daughter">I Became the Sea Guardian&#039;s Adopted Daughter</a>
    <div class="clearfix graph-content pt8">
      <span class="fl-r fn-grey2">Oct 1, 7:19 AM</span>
      <div class="graph fl-l"><span class="graph-inner manga completed" style="width:190px"></span></div>
    </div>

    <div class="fn-grey2">
            Completed
                        <span class="text manga completed">60</span>/60
                    &middot;             Scored
      <span class="text manga completed score-label score-5">5</span></div>
  </div>
</div>
`;

const PLAN_TO_READ = `<div class="statistics-updates di-b w100 mb8">
  <a href="https://myanimelist.net/manga/168969/Black_and_White_Martial_Emperor" class="fl-l di-ib mr8 image">
    <img class="lazyload" data-src="https://cdn.myanimelist.net/r/80x120/images/manga/1/300299.jpg?s=1f5f5fdf260305c918639d1cb6cf6c24" width="40" alt="Black and White Martial Emperor">
  </a>


  <div class="data">
    <a href="https://myanimelist.net/manga/168969/Black_and_White_Martial_Emperor">Black and White Martial Emperor</a>
    <div class="clearfix graph-content pt8">
      <span class="fl-r fn-grey2">Yesterday, 2:13 PM</span>
      <div class="graph fl-l"><span class="graph-inner manga plan_to_read" style="width:0px"></span></div>
    </div>

    <div class="fn-grey2">
            Plan to Read
            &middot;             Scored
      -</div>
  </div>
</div>`;

const mangaSection = (...entries: string[]) =>
  `<h5 class="mb12">Last Manga Updates</h5>\n${entries.join('\n')}\n          </div>\n        </div>`;

describe('user updates parser, on real entries', () => {
  it('decodes the title instead of serving the HTML entity', () => {
    const [update] = parseUserUpdates(mangaSection(SEA_GUARDIAN)).manga;
    expect(update?.entry.title).toBe("I Became the Sea Guardian's Adopted Daughter");
    expect(update && row(update)).toEqual({ status: 'completed', progress: 60, total: 60, score: 5 });
  });

  it('leaves progress and total null on a plan-to-read entry, which prints no counter', () => {
    const [plan, completed] = parseUserUpdates(mangaSection(PLAN_TO_READ, SEA_GUARDIAN)).manga;
    expect(plan && row(plan)).toEqual({ status: 'plan to read', progress: null, total: null, score: null });
    // The entry after it still gets its own numbers, not the plan entry's nulls or the reverse.
    expect(completed && row(completed)).toEqual({ status: 'completed', progress: 60, total: 60, score: 5 });
  });
});
