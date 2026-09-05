/** The anime, manga and characters a club is associated with, derived from its detail page. */
export interface ClubRelations {
  anime: { malId: number; title: string }[];
  manga: { malId: number; title: string }[];
  characters: { malId: number; name: string }[];
}
