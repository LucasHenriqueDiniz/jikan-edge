import { z } from 'zod';
import type { EpisodeDetail } from '../domain/episode-detail';
import { capture, decodeHtml, ParserError, richText } from './html';

export const schema = z.object({
  malId: z.number().int().positive(),
  episode: z.number().int().positive(),
  title: z.string().nullable(),
  titleAlternative: z.string().nullable(),
  duration: z.string().nullable(),
  aired: z.string().nullable(),
  synopsis: z.string().nullable(),
});

function extractSynopsis(html: string): string | null {
  const marker = '<h2 class="fw-b">Synopsis</h2>';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const rest = html.slice(start + marker.length);
  const end = rest.search(/<(?:div|h2|table)[ >]/i);
  const decoded = richText(rest.slice(0, end === -1 ? 8_000 : end));
  return decoded || null;
}

// MAL answers an episode number it has no page for with 200, the anime's chrome, an empty heading
// (`#99999 - `) and this notice, so the status says nothing. The notice is what episode 1 lacks:
// `<div class="badresult al"> Sorry, this anime doesn't seem to have any episode information yet.`
export function isMissingEpisode(html: string): boolean {
  return /<div class="badresult[^"]*">\s*Sorry, this anime doesn't seem to have any episode information/i.test(html);
}

export function parseEpisodeDetail(html: string, malId: number, episode: number): EpisodeDetail {
  const headingMatch = html.match(
    /<h2 class="fs18 lh11"[^>]*>\s*<span class="fw-n">#\d+\s*-\s*<\/span>([\s\S]*?)<\/h2>/i,
  );
  const detail: EpisodeDetail = {
    malId,
    episode,
    title: headingMatch ? decodeHtml(headingMatch[1]) || null : null,
    titleAlternative: capture(html, /<p class="fn-grey2"[^>]*>\s*([\s\S]*?)\s*<\/p>/i),
    duration: capture(html, /<span class="fw-b">Duration:\s*<\/span>([^<]*)/i),
    aired: capture(html, /<span class="fw-b">Aired:\s*<\/span>([^<]*)/i),
    synopsis: extractSynopsis(html),
  };
  const validated = schema.safeParse(detail);
  if (!validated.success) throw new ParserError('invalid_episode_detail');
  return validated.data;
}
