import { originalImage } from './html';

export interface UserUpdate {
  entry: { malId: number; title: string; imageUrl: string | null };
  score: number | null;
  status: string;
  progress: number | null;
  total: number | null;
  date: string;
}
export interface UserUpdates {
  anime: UserUpdate[];
  manga: UserUpdate[];
}
function part(html: string, marker: string, end: string): string {
  const i = html.indexOf(marker);
  const j = html.indexOf(end, i + marker.length);
  return i < 0 ? '' : html.slice(i, j < 0 ? i + 30000 : j);
}
function parse(html: string, media: 'anime' | 'manga'): UserUpdate[] {
  const result: UserUpdate[] = [];
  const blocks = part(
    html,
    `Last ${media === 'anime' ? 'Anime' : 'Manga'} Updates`,
    media === 'anime' ? 'Manga Stats' : '</div>\n        </div>',
  ).matchAll(/<div class="statistics-updates[\s\S]*?<\/div>\s*<\/div>/gi);
  for (const m of blocks) {
    const b = m[0];
    const link = new RegExp(`href="https://myanimelist\\.net/${media}/(\\d+)/[^"]*"`).exec(b);
    const title = /<div class="data">\s*<a[^>]*>([^<]+)</i.exec(b)?.[1]?.trim();
    const image = originalImage(/data-src="([^"]+)"/i.exec(b)?.[1] ?? null);
    const date = /<span class="fl-r fn-grey2">\s*([^<]+)</i.exec(b)?.[1]?.trim();
    const status = new RegExp(`graph-inner ${media} ([a-z_]+)`).exec(b)?.[1]?.replace(/_/g, ' ') ?? '';
    const progress = /<span class="text [^"]+">(\d+)<\/span>\/(\d+|\?)/i.exec(b);
    if (link && title && date)
      result.push({
        entry: { malId: Number(link[1]), title, imageUrl: image },
        score: null,
        status,
        progress: progress ? Number(progress[1]) : null,
        total: progress && progress[2] !== '?' ? Number(progress[2]) : null,
        date,
      });
  }
  return result;
}
export function parseUserUpdates(html: string): UserUpdates {
  return { anime: parse(html, 'anime'), manga: parse(html, 'manga') };
}
