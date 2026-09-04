import type { ExternalLink, RelationEntry, StreamingEntry } from '../domain/anime';
import { decodeHtml } from './html';

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
  return relations;
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
