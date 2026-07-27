import { PARSER_VERSION } from '../domain/user';

export interface Favorite { mal_id: number; title?: string; name?: string; url: string; type?: string; imageUrl: string | null; }
export interface Favorites { anime: Favorite[]; manga: Favorite[]; characters: Favorite[]; people: Favorite[]; }

function section(html: string, id: string): string { const start = html.indexOf(`id="${id}"`); return start < 0 ? '' : html.slice(start, html.indexOf('fav-slide-block', start + 20) < 0 ? start + 40_000 : html.indexOf('fav-slide-block', start + 20)); }
function image(block: string): string | null {
  const candidate = /data-src="([^"]+)"/i.exec(block)?.[1] ?? /data-srcset="([^\s,"]+)/i.exec(block)?.[1] ?? /srcset="([^\s,"]+)/i.exec(block)?.[1] ?? /src="([^"]+)"/i.exec(block)?.[1];
  if (!candidate || /spacer\.gif|placeholder/i.test(candidate)) return null;
  try { const url = new URL(candidate); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; }
}
function parse(html: string, id: string, kind: 'anime' | 'manga' | 'character' | 'people'): Favorite[] {
  const result: Favorite[] = []; const items = /<li\s+class="btn-fav[^"]*"[\s\S]*?<\/li>/gi;
  for (const item of section(html, id).matchAll(items)) { const block = item[0]; const link = new RegExp(`<a\\s+href="(?:https://myanimelist\\.net)?/(${kind})/(\\d+)/[^"]*"`, 'i').exec(block); const title = /<span class="title[^>]*">([\s\S]*?)<\/span>/i.exec(block)?.[1]; if (!link || !title) continue; const label = title.replace(/<[^>]+>/g, '').trim(); const type = kind === 'anime' || kind === 'manga' ? (/<span class="users">([^&<]+)/i.exec(block)?.[1]?.trim() ?? undefined) : undefined; result.push({ mal_id: Number(link[2]), ...(kind === 'character' || kind === 'people' ? { name: label } : { title: label }), url: `https://myanimelist.net/${kind}/${link[2]}`, ...(type ? { type } : {}), imageUrl: image(block) }); }
  return result;
}
export function parseUserFavorites(html: string): Favorites { return { anime: parse(html, 'anime_favorites', 'anime'), manga: parse(html, 'manga_favorites', 'manga'), characters: parse(html, 'character_favorites', 'character'), people: parse(html, 'person_favorites', 'people') }; }
export const FAVORITES_PARSER_VERSION = `${PARSER_VERSION}:favorites`;
