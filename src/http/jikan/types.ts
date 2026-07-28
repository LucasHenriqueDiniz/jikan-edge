// Wire-level types for the Jikan v4 response shape.
//
// These describe what leaves the Worker, not what we store. Domain interfaces in `src/domain`
// stay camelCase and are what lands in D1 `payload_json`; the mappers in this directory are the
// only translation point. Keep it that way — writing a Jikan-shaped object into a repository
// would invalidate every cached payload.

export interface JikanImageSet {
  image_url: string | null;
  small_image_url: string | null;
  large_image_url: string | null;
}

export interface JikanImages {
  jpg: JikanImageSet;
  webp: JikanImageSet;
}

export type JikanTitleType = 'Default' | 'English' | 'Japanese' | 'Synonym';

export interface JikanTitle {
  type: JikanTitleType;
  title: string;
}

export interface JikanDateProp {
  day: number | null;
  month: number | null;
  year: number | null;
}

export interface JikanDateRange {
  from: string | null;
  to: string | null;
  prop: { from: JikanDateProp; to: JikanDateProp };
  string: string | null;
}

/** The `{mal_id, type, name, url}` reference Jikan uses everywhere it points at another entity. */
export interface MalEntity {
  mal_id: number;
  type: string;
  name: string;
  url: string;
}

export type MalEntityType = 'anime' | 'manga' | 'character' | 'people' | 'producer' | 'magazine' | 'clubs' | 'profile';

export interface JikanRelation {
  relation: string;
  entry: MalEntity[];
}

export interface JikanTrailer {
  youtube_id: string | null;
  url: string | null;
  embed_url: string | null;
  images: JikanImageSet;
}

export interface JikanBroadcast {
  day: string | null;
  time: string | null;
  timezone: string | null;
  string: string | null;
}

export interface JikanPagination {
  last_visible_page: number;
  has_next_page: boolean;
  current_page: number;
  items: { count: number; total: number | null; per_page: number };
}
