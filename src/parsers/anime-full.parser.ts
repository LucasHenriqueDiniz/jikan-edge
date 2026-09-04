import { z } from 'zod';
import type { AnimeFull } from '../domain/anime-full';
import type { AnimeThemeSongs, ThemeSong } from '../domain/anime-theme';
import { decodeHtml, ParserError } from './html';
import { parseAnimeDetail } from './anime-detail.parser';

const themeSongSchema = z.object({
  title: z.string().min(1),
  artist: z.string().nullable(),
  episodes: z.string().nullable(),
});
const themeSongsSchema = z.object({ openings: z.array(themeSongSchema), endings: z.array(themeSongSchema) });

function extractSongs(block: string): ThemeSong[] {
  const songs: ThemeSong[] = [];
  for (const row of block.split('<td width="84%">').slice(1)) {
    // MAL is mid-rollout of a newer widget that drops the dedicated title span: the index span
    // ("1:") is followed directly by a quoted plain-text title instead of a nested
    // theme-song-title span. Both shapes appear on the same page during the rollout (confirmed
    // live: Frieren is 100% new, Fullmetal Alchemist: Brotherhood mixes both), so each row is
    // checked independently rather than branching on the whole document.
    const rawTitle =
      row.match(/class="theme-song-title">([^<]+)<\/span>/i)?.[1] ??
      row.match(/class="theme-song-index">[^<]*<\/span>&nbsp;("[^"]+")/i)?.[1];
    if (!rawTitle) continue;
    const title = decodeHtml(rawTitle.replace(/^"+|"+$/g, ''));
    if (!title) continue;
    const artist = decodeHtml(row.match(/class="theme-song-artist">\s*by\s*([^<]+)<\/span>/i)?.[1] ?? '') || null;
    const episodes = decodeHtml(row.match(/class="theme-song-episode">\(([^)]+)\)<\/span>/i)?.[1] ?? '') || null;
    songs.push({ title, artist, episodes });
  }
  return songs;
}

// MAL keeps the openings/endings tables on the same detail page, right after each other under
// "Opening Theme"/"Ending Theme" headers (note MAL's own typo in the class: "opnening").
function extractThemeSongs(html: string): AnimeThemeSongs {
  const openStart = html.indexOf('js-theme-songs opnening');
  const endStart = html.indexOf('js-theme-songs ending');
  const openings =
    openStart === -1 ? [] : extractSongs(html.slice(openStart, endStart === -1 ? openStart + 10_000 : endStart));
  let endings: ThemeSong[] = [];
  if (endStart !== -1) {
    const nextSection = html.indexOf('<h2>', endStart);
    endings = extractSongs(html.slice(endStart, nextSection === -1 ? endStart + 10_000 : nextSection));
  }
  return { openings, endings };
}

export function parseAnimeFull(html: string, malId: number, fetchedAt = new Date().toISOString()): AnimeFull {
  const detail = parseAnimeDetail(html, malId, fetchedAt);
  const themeSongs = extractThemeSongs(html);
  const validated = themeSongsSchema.safeParse(themeSongs);
  if (!validated.success) throw new ParserError('invalid_anime_full');
  return { ...detail, themeSongs: validated.data };
}
