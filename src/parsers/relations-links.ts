import type { ExternalLink, RelationEntry, StreamingEntry } from '../domain/anime';
import { decodeHtml } from './html';

// MAL renders related entries in two layouts on the same page: a few tiles with a cover (usually
// the adaptation), then an `entries-table` with every other relation, one row per kind. Reading
// only the tiles served 2 of One Piece's 94 relations and lost Berserk's Spin-Off and Other rows
// (measured 2026-10-11). The table's label cell ends in a colon (`Side Story:`) and its entries
// are `<li><a href="…/anime/466/…">Title</a> (OVA)</li>`, including the ones MAL hides behind a
// "more" toggle with `hide-entry`.
function tableRelations(html: string): RelationEntry[] {
  const start = html.indexOf('class="entries-table"');
  if (start === -1) return [];
  const end = html.indexOf('</table>', start);
  const table = html.slice(start, end === -1 ? undefined : end);
  const relations: RelationEntry[] = [];
  for (const row of table.split('<tr').slice(1)) {
    const relation = decodeHtml(row.match(/<td[^>]*>([^<]+?):?\s*<\/td>/i)?.[1] ?? '').replace(/:$/, '');
    if (!relation) continue;
    for (const link of row.matchAll(
      /<a href="https:\/\/myanimelist\.net\/(anime|manga)\/(\d+)\/[^"]*">([^<]+)<\/a>/gi,
    )) {
      relations.push({
        relation,
        type: link[1] === 'manga' ? 'manga' : 'anime',
        malId: Number(link[2]),
        title: decodeHtml(link[3]),
      });
    }
  }
  return relations;
}

export function extractRelations(html: string): RelationEntry[] {
  const relations: RelationEntry[] = [];
  for (const block of html.split('class="entry borderClass').slice(1)) {
    const relation = decodeHtml(block.match(/class="relation">\s*([^<(]+?)\s*\(/i)?.[1] ?? '');
    const linkMatch = block.match(
      /class="title">\s*<a href="https:\/\/myanimelist\.net\/(anime|manga)\/(\d+)\/[^"]*">\s*([^<]+?)\s*<\/a>/i,
    );
    if (!relation || !linkMatch) continue;
    relations.push({
      relation,
      type: linkMatch[1] === 'manga' ? 'manga' : 'anime',
      malId: Number(linkMatch[2]),
      title: decodeHtml(linkMatch[3]),
    });
  }
  return [...relations, ...tableRelations(html)];
}

export function extractExternalLinks(html: string): ExternalLink[] {
  const links: ExternalLink[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(
    /<a href="([^"]+)" target="_blank" class="link ga-click" data-ga-click-type="external-links-[^"]*"[^>]*>(?:<i[^>]*>\s*<\/i>|<img[^>]*>)<div class="caption">([^<]+)<\/div><\/a>/gi,
  )) {
    const url = match[1].replace(/&amp;/g, '&');
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ name: decodeHtml(match[2]), url });
  }
  return links;
}

export function extractStreaming(html: string): StreamingEntry[] {
  const raw = html.match(/data-raw='([^']+)'/i)?.[1];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { data?: { platform?: { name?: string }; available?: boolean; url?: string }[] };
    return (parsed.data ?? [])
      .filter(
        (item): item is { platform: { name: string }; available: boolean; url: string } =>
          typeof item.platform?.name === 'string' && typeof item.url === 'string',
      )
      .map((item) => ({ name: item.platform.name, url: item.url, available: Boolean(item.available) }));
  } catch {
    return [];
  }
}
