import { describe, expect, it } from 'vitest';
import { parseScheduleByDay } from '../../src/parsers/schedule.parser';

function card(malId: number, title: string, typeId = 1): string {
  return `<div class="js-seasonal-anime js-anime-type-all js-anime-type-${typeId}"><h2 class="h2_anime_title"><a href="https://myanimelist.net/anime/${malId}/X" class="link-title">${title}</a></h2><span class="js-members">100</span><span class="js-score">8.00</span><span class="js-start_date">20260101</span><img data-src="https://cdn.myanimelist.net/x.jpg"></div>`;
}

describe('schedule parser', () => {
  it('groups seasonal cards by weekday section', () => {
    const html = `<html><body>
      <div class="anime-header">Monday</div>${card(1, 'Monday Show')}
      <div class="anime-header">Friday</div>${card(2, 'Friday Show A')}${card(3, 'Friday Show B')}
      <div class="anime-header">Unknown</div>${card(4, 'Unknown Show')}
    </body></html>`;
    const schedule = parseScheduleByDay(html);
    expect(schedule.monday.map((entry) => entry.malId)).toEqual([1]);
    expect(schedule.friday.map((entry) => entry.malId)).toEqual([2, 3]);
    expect(schedule.unknown.map((entry) => entry.malId)).toEqual([4]);
    expect(schedule.tuesday).toEqual([]);
  });

  it('throws on a page with no schedule entries', () => {
    expect(() => parseScheduleByDay('<html><body>nothing</body></html>')).toThrow('empty_schedule_page');
  });

  // The schedule shares the seasonal card parser, so it shared the null `type` too. It also proves
  // the type cannot come from the heading here: on this page the heading is a weekday.
  it('carries the media type through, despite the heading being a day', () => {
    const html = `<html><body>
      <div class="anime-header">Monday</div>${card(1, 'Monday Show', 1)}
      <div class="anime-header">Friday</div>${card(2, 'Friday Movie', 3)}
    </body></html>`;
    const schedule = parseScheduleByDay(html);
    expect(schedule.monday[0]?.type).toBe('TV');
    expect(schedule.friday[0]?.type).toBe('Movie');
  });
});
