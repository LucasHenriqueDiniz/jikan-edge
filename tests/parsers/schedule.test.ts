import { describe, expect, it } from 'vitest';
import { parseScheduleByDay } from '../../src/parsers/schedule.parser';

function card(malId: number, title: string): string {
  return `<div class="js-seasonal-anime"><h2 class="h2_anime_title"><a href="https://myanimelist.net/anime/${malId}/X" class="link-title">${title}</a></h2><span class="js-members">100</span><span class="js-score">8.00</span><span class="js-start_date">20260101</span><img data-src="https://cdn.myanimelist.net/x.jpg"></div>`;
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
});
