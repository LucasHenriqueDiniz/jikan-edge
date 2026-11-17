import type { UserUpdate, UserUpdates } from '../domain/user-updates';
import { decodeHtml, numeric, originalImage } from './html';

export type { UserUpdate, UserUpdates };

const BLOCK_START = '<div class="statistics-updates';

function part(html: string, marker: string, end: string): string {
  const i = html.indexOf(marker);
  const j = html.indexOf(end, i + marker.length);
  return i < 0 ? '' : html.slice(i, j < 0 ? i + 30000 : j);
}

/**
 * One entry runs from its own `statistics-updates` div to the next one (or the end of the section).
 * The entry nests three divs — `data` holds the `graph-content` row and, after it, the `fn-grey2` line
 * with `Completed 60/60 · Scored 5` — so the old "first `</div>` followed by `</div>`" bound closed on
 * `graph-content` and every entry lost its progress line: progress, total and score came out null on
 * 6 of 6 entries of a real profile. Cutting on the next opening needs no div counting.
 */
function blocks(section: string): string[] {
  const starts: number[] = [];
  for (let at = section.indexOf(BLOCK_START); at >= 0; at = section.indexOf(BLOCK_START, at + 1)) starts.push(at);
  return starts.map((start, index) => section.slice(start, starts[index + 1] ?? section.length));
}

/**
 * The `fn-grey2` div holds only spans, so its first `</div>` closes it. Reading progress and score from
 * this line alone keeps the last entry of a section from reaching into whatever follows the feed.
 */
function statusLine(block: string): string {
  return /<div class="fn-grey2">([\s\S]*?)<\/div>/i.exec(block)?.[1] ?? '';
}

/**
 * `<span class="text manga reading">41</span>/?` — the total is `?` while MAL does not know it. A
 * plan-to-watch/read entry prints no counter at all (`Plan to Read · Scored -`), so both stay null.
 */
function progressOf(line: string, media: 'anime' | 'manga'): { progress: number | null; total: number | null } {
  const counted = new RegExp(`<span class="text ${media} [a-z_]+">\\s*([\\d,]+)\\s*</span>\\s*/\\s*([\\d,]+|\\?)`).exec(
    line,
  );
  if (!counted) return { progress: null, total: null };
  return { progress: numeric(counted[1]), total: counted[2] === '?' ? null : numeric(counted[2]) };
}

/** `Scored <span class="... score-label score-5">5</span>`; an unscored entry prints `Scored -`. */
function scoreOf(line: string): number | null {
  return numeric(/score-label score-\d+">\s*(\d+)\s*</i.exec(line)?.[1] ?? null);
}

function parse(html: string, media: 'anime' | 'manga'): UserUpdate[] {
  const result: UserUpdate[] = [];
  const section = part(
    html,
    `Last ${media === 'anime' ? 'Anime' : 'Manga'} Updates`,
    media === 'anime' ? 'Manga Stats' : '</div>\n        </div>',
  );
  for (const b of blocks(section)) {
    const link = new RegExp(`href="https://myanimelist\\.net/${media}/(\\d+)/[^"]*"`).exec(b);
    const rawTitle = /<div class="data">\s*<a[^>]*>([^<]+)</i.exec(b)?.[1];
    const title = rawTitle === undefined ? '' : decodeHtml(rawTitle);
    const image = originalImage(/data-src="([^"]+)"/i.exec(b)?.[1] ?? null);
    const date = /<span class="fl-r fn-grey2">\s*([^<]+)</i.exec(b)?.[1]?.trim();
    const status = new RegExp(`graph-inner ${media} ([a-z_]+)`).exec(b)?.[1]?.replace(/_/g, ' ') ?? '';
    const line = statusLine(b);
    if (link && title && date)
      result.push({
        entry: { malId: Number(link[1]), title, imageUrl: image },
        score: scoreOf(line),
        status,
        ...progressOf(line, media),
        date,
      });
  }
  return result;
}
export function parseUserUpdates(html: string): UserUpdates {
  return { anime: parse(html, 'anime'), manga: parse(html, 'manga') };
}
