import type { RelationEntry } from '../../domain/anime';
import type { NamedRef } from '../../domain/named-ref';
import type {
  JikanBroadcast,
  JikanDateRange,
  JikanImages,
  JikanImageSet,
  JikanRelation,
  JikanTitle,
  JikanTrailer,
  MalEntity,
  MalEntityType,
} from './types';

const MAL_BASE = 'https://myanimelist.net';

/** Canonical MAL URL for an entity we only know by id. Deterministic — never a fetch. */
export function malUrl(type: MalEntityType, malId: number): string {
  return `${MAL_BASE}/${type}/${malId}`;
}

const EMPTY_IMAGE_SET: JikanImageSet = { image_url: null, small_image_url: null, large_image_url: null };

/**
 * MAL gives us exactly one image URL per entity. Jikan exposes three sizes across two formats.
 *
 * We fill only what we actually know and leave the rest null rather than repeating the same URL
 * in every slot — a client sizing an <img> off `large_image_url` deserves a null it can branch
 * on, not a thumbnail wearing a large-image label. The keys are always present so that
 * `images.jpg.image_url` never throws on a missing intermediate object.
 */
export function images(url: string | null, thumbnailUrl: string | null = null): JikanImages {
  return {
    jpg: { image_url: url, small_image_url: thumbnailUrl, large_image_url: null },
    webp: { ...EMPTY_IMAGE_SET },
  };
}

/** Jikan omits absent title variants from the array rather than emitting nulls. */
export function titles(source: { title: string; titleEnglish?: string | null; titleJapanese?: string | null }): JikanTitle[] {
  const out: JikanTitle[] = [{ type: 'Default', title: source.title }];
  if (source.titleEnglish) out.push({ type: 'English', title: source.titleEnglish });
  if (source.titleJapanese) out.push({ type: 'Japanese', title: source.titleJapanese });
  return out;
}

const EMPTY_DATE_PROP = { day: null, month: null, year: null };

/**
 * We parse MAL's date range as one opaque string ("Apr 3, 1998 to Apr 24, 1999"), never as
 * structured dates. `string` therefore carries the whole truth and `from`/`to`/`prop` stay null.
 *
 * Deliberately does not attempt to parse: MAL emits "1998", "Apr 1998 to ?", "Not available" and
 * more, and a parser that gets the common case right emits a confidently wrong `from` for the
 * rest. Structured dates belong in the HTML parser (as new domain fields), not here.
 */
export function daterange(raw: string | null): JikanDateRange {
  return { from: null, to: null, prop: { from: { ...EMPTY_DATE_PROP }, to: { ...EMPTY_DATE_PROP } }, string: raw };
}

export function entity(type: MalEntityType, malId: number, name: string, url?: string | null): MalEntity {
  return { mal_id: malId, type, name, url: url ?? malUrl(type, malId) };
}

/** Maps the `{malId, name, url}` refs the parsers now capture from anchor hrefs. */
export function entities(type: MalEntityType, refs: NamedRef[]): MalEntity[] {
  return refs.map((ref) => entity(type, ref.malId, ref.name, ref.url));
}

/**
 * Ours is a flat list of related titles; Jikan groups them under each relation label.
 * First-seen order is preserved so the output tracks the order MAL rendered.
 */
export function relations(rows: RelationEntry[]): JikanRelation[] {
  const grouped = new Map<string, MalEntity[]>();
  for (const row of rows) {
    const label = titleCase(row.relation);
    const bucket = grouped.get(label);
    const ref = entity(row.type, row.malId, row.title);
    if (bucket) bucket.push(ref);
    else grouped.set(label, [ref]);
  }
  return [...grouped].map(([relation, entry]) => ({ relation, entry }));
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|\s)\S/g, (match) => match.toUpperCase());
}

const YOUTUBE_ID = /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{6,})/;

/** Only meaningful where we actually scraped a video URL (`/videos`, `/watch/promos`). */
export function trailer(videoUrl: string | null, imageUrl: string | null = null): JikanTrailer {
  const youtubeId = videoUrl?.match(YOUTUBE_ID)?.[1] ?? null;
  return {
    youtube_id: youtubeId,
    url: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : videoUrl,
    embed_url: youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : null,
    images: { image_url: imageUrl, small_image_url: null, large_image_url: null },
  };
}

export function broadcast(day: string | null = null): JikanBroadcast {
  return { day, time: null, timezone: null, string: null };
}

export const EMPTY_TRAILER: JikanTrailer = {
  youtube_id: null,
  url: null,
  embed_url: null,
  images: { ...EMPTY_IMAGE_SET },
};
