import { PARSER_VERSION } from '../domain/user';
import { imageFrom } from './html';

export interface Favorite { malId: number; title?: string; name?: string; url: string; type?: string; startYear?: number | null; imageUrl: string | null; }
export interface Favorites { anime: Favorite[]; manga: Favorite[]; characters: Favorite[]; people: Favorite[]; }

function section(html: string, id: string): string { const start = html.indexOf(`id="${id}"`); return start < 0 ? '' : html.slice(start, html.indexOf('fav-slide-block', start + 20) < 0 ? start + 40_000 : html.indexOf('fav-slide-block', start + 20)); }
// `<span class="users">TV&middot;1998</span>` carries media type and start year for anime/manga favorites.
function media(block: string): { type?: string; startYear: number | null } {
  const raw = /<span class="users">([^<]*)<\/span>/i.exec(block)?.[1] ?? '';
  const [type, year] = raw.split(/&middot;|·/).map((part) => part.trim());
  return { ...(type ? { type } : {}), startYear: year && /^\d{4}$/.test(year) ? Number(year) : null };
}
function parse(html: string, id: string, kind: 'anime' | 'manga' | 'character' | 'people'): Favorite[] {
  const result: Favorite[] = []; const items = /<li\s+class="btn-fav[^"]*"[\s\S]*?<\/li>/gi;
  for (const item of section(html, id).matchAll(items)) { const block = item[0]; const link = new RegExp(`<a\\s+href="(?:https://myanimelist\\.net)?/(${kind})/(\\d+)/[^"]*"`, 'i').exec(block); const title = /<span class="title[^>]*">([\s\S]*?)<\/span>/i.exec(block)?.[1]; if (!link || !title) continue; const label = title.replace(/<[^>]+>/g, '').trim(); result.push({ malId: Number(link[2]), ...(kind === 'character' || kind === 'people' ? { name: label } : { title: label }), url: `https://myanimelist.net/${kind}/${link[2]}`, ...(kind === 'anime' || kind === 'manga' ? media(block) : {}), imageUrl: imageFrom(block) }); }
  return result;
}
export function parseUserFavorites(html: string): Favorites { return { anime: parse(html, 'anime_favorites', 'anime'), manga: parse(html, 'manga_favorites', 'manga'), characters: parse(html, 'character_favorites', 'character'), people: parse(html, 'person_favorites', 'people') }; }
export const FAVORITES_PARSER_VERSION = `${PARSER_VERSION}:favorites`;
