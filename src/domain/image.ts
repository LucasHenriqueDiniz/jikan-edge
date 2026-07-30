// Which size variants MyAnimeList's CDN actually serves, measured per entity type against real
// URLs rather than assumed: anime and manga have both, a character has no `large`, a person has no
// `small`, and producer/club logos have no variant at all (their URLs carry no file extension to
// suffix). `null` therefore means "this type has no such size", not "we did not look".
export type ImageKind = 'anime' | 'manga' | 'character' | 'person';

export interface ImageSet {
  small: string | null;
  medium: string | null;
  large: string | null;
}
