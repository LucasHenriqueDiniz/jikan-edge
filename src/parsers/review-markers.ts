import { z } from 'zod';
import type { ReviewMarkers, ReviewReactions } from '../domain/review';

// Shared by the three parsers that read MAL's review cards (global feed, a title's page, a profile):
// the markup below is identical on all three, measured on 2026-10-11.
//
//   <a href="https://myanimelist.net/reviews.php?id=2772" … data-ga-click-type="review-permalink">
//   <div class="tag preliminary">Preliminary <span> (344/? eps) </span></div>
//   <div class="tag spoiler">Spoiler</div>
//   … data-reactions='{"icon":["1","2","4"],"num":6056,"count":["5622","201","40","137","7","46","3"]}'

const reactionsSchema = z.object({
  overall: z.number().int().nonnegative(),
  nice: z.number().int().nonnegative(),
  loveIt: z.number().int().nonnegative(),
  funny: z.number().int().nonnegative(),
  confusing: z.number().int().nonnegative(),
  informative: z.number().int().nonnegative(),
  wellWritten: z.number().int().nonnegative(),
  creative: z.number().int().nonnegative(),
});

export const reviewMarkersShape = {
  reviewId: z.number().int().positive().nullable(),
  url: z.string().url().nullable(),
  isPreliminary: z.boolean(),
  isSpoiler: z.boolean(),
  episodesWatched: z.number().int().nonnegative().nullable(),
  chaptersRead: z.number().int().nonnegative().nullable(),
  reactions: reactionsSchema.nullable(),
};

// The positions follow each button's `data-val`: 1 nice, 2 loveit, 3 funny, 4 confusing,
// 5 informative, 6 well-written, 7 creative. Every one of the seven was read off the buttons, and
// the `icon` list — the three largest counts — agrees with the mapping on every card checked.
const REACTION_ORDER = ['nice', 'loveIt', 'funny', 'confusing', 'informative', 'wellWritten', 'creative'] as const;

// On the global feed only some cards carry a payload; the rest have `data-reactions=''`. Absent
// means "not printed", not "zero", so it stays null rather than becoming a row of zeros.
function reactionsOf(chunk: string): ReviewReactions | null {
  const raw = chunk.match(/data-reactions='(\{[^']*\})'/)?.[1];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { num?: unknown; count?: unknown };
    if (!Array.isArray(parsed.count) || parsed.count.length !== REACTION_ORDER.length) return null;
    const counts = parsed.count.map((value) => Number(value));
    if (counts.some((value) => !Number.isInteger(value) || value < 0)) return null;
    const reactions = Object.fromEntries(REACTION_ORDER.map((name, index) => [name, counts[index]])) as Omit<
      ReviewReactions,
      'overall'
    >;
    const total = Number(parsed.num);
    return {
      overall: Number.isInteger(total) && total >= 0 ? total : counts.reduce((sum, value) => sum + value, 0),
      ...reactions,
    };
  } catch {
    return null;
  }
}

export function reviewMarkers(chunk: string): ReviewMarkers {
  const permalink = chunk.match(/href="(https:\/\/myanimelist\.net\/reviews\.php\?id=(\d+))"/i);
  const preliminary = chunk.match(
    /<div class="tag preliminary">[^<]*<span>\s*\((\d+)\/[^)]*?\s*(eps|chp)\)\s*<\/span>/i,
  );
  return {
    reviewId: permalink ? Number(permalink[2]) : null,
    url: permalink?.[1] ?? null,
    isPreliminary: /<div class="tag preliminary">/i.test(chunk),
    isSpoiler: /<div class="tag spoiler">/i.test(chunk),
    episodesWatched: preliminary?.[2] === 'eps' ? Number(preliminary[1]) : null,
    chaptersRead: preliminary?.[2] === 'chp' ? Number(preliminary[1]) : null,
    reactions: reactionsOf(chunk),
  };
}
