/**
 * A voice actor as MyAnimeList lists them, on a character page or in a title's character table.
 *
 * Single declaration on purpose. This shape used to exist twice — here and in
 * `characters-staff.ts` — with the same four fields in a different order, which TypeScript treats as
 * the same type and a reader treats as two things to keep in step.
 *
 * **There is no `VOICE_ACTOR_PARSER_VERSION`, and adding one back would be a mistake.** Voice actors
 * are never cached under a key of their own: the data always rides inside a `character-full`,
 * `character-media` or `person-media` payload, each invalidated by its own version. A constant here
 * would invalidate nothing, and someone bumping it to force a refetch would reasonably conclude the
 * cache layer was broken. To force one, bump `CHARACTER_MEDIA_PARSER_VERSION` and
 * `CHARACTER_FULL_PARSER_VERSION` instead.
 */
export interface VoiceActor {
  malId: number;
  name: string;
  imageUrl: string | null;
  language: string | null;
}
