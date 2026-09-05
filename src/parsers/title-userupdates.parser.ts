import { z } from 'zod';
import type { TitleUserUpdate } from '../domain/title-userupdates';
import { decodeHtml, numeric, originalImage } from './html';

const schema = z.object({
  username: z.string().min(1),
  imageUrl: z.string().url().nullable(),
  score: z.number().nullable(),
  status: z.string().min(1),
  progress: z.number().nullable(),
  total: z.number().nullable(),
  date: z.string().min(1),
});

// The recent-member-updates rows live on the same /stats page used by /statistics — MAL has no
// dedicated userupdates page per title (verified by byte comparison; see docs/routes.md), but the
// data itself is public here. The anime and manga variants of this page use slightly different
// row markup (anime: compact cells with class="ac"; manga: multi-line cells with align="center"
// and separate volume/chapter columns), so extraction is anchored on the image-member avatar
// links and tolerant about the cells that follow.
export function parseTitleUserUpdates(html: string): TitleUserUpdate[] {
  const updates: TitleUserUpdate[] = [];
  const chunks = html.split('class="image-member"');
  for (let index = 1; index < chunks.length; index += 1) {
    const previous = chunks[index - 1];
    const anchor = previous.match(
      /<a href="https:\/\/myanimelist\.net\/profile\/([^"]+)" style="background-image:url\(([^)]*)\)"\s*$/i,
    );
    if (!anchor) continue;
    const username = decodeHtml(anchor[1]);
    const imageUrl = anchor[2] && !anchor[2].includes('kaomoji') ? originalImage(anchor[2]) : null;
    const rowEnd = chunks[index].indexOf('</tr>');
    const row = chunks[index].slice(0, rowEnd === -1 ? 3_000 : rowEnd);
    const cells = [
      ...row.matchAll(/<td class="borderClass(?:\s+ac)?"(?:\s+align="center")?>\s*([\s\S]*?)\s*<\/td>/gi),
    ].map((cell) => decodeHtml(cell[1]));
    if (cells.length < 3) continue;
    const scoreText = cells[0];
    const status = cells[1];
    const date = cells[cells.length - 1];
    let progress: number | null = null;
    let total: number | null = null;
    for (const cell of cells.slice(2, -1)) {
      const pair = cell.match(/^(\d+)\s*\/\s*(\d+|\?)$/);
      if (pair) {
        progress = Number(pair[1]);
        total = pair[2] === '?' ? null : Number(pair[2]);
        break;
      }
      const single = cell.match(/^(\d+)$/);
      if (single && progress === null) progress = Number(single[1]);
    }
    const candidate = {
      username,
      imageUrl,
      score: numeric(scoreText === '-' ? null : scoreText),
      status,
      progress,
      total,
      date,
    };
    const parsed = schema.safeParse(candidate);
    if (parsed.success) updates.push(parsed.data);
  }
  return updates;
}
