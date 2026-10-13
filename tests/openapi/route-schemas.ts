// What each route answers inside `data`, by Hono route pattern — the response half of the contract
// that `src/http/query-contract.ts` is for the request half.
//
// It lives under `tests/` on purpose. Nothing at runtime needs it, and keeping it here means the HTTP
// layer never imports a parser: the schemas are the parsers' own (exported for this, unchanged), and
// the few shapes no parser validates are declared below against their domain type with `satisfies`,
// so a drift between the two is a compile error rather than a wrong document.
//
// `tests/openapi/openapi.test.ts` fails if a registered route has no entry here, the same way the
// query-contract test fails for a route missing from QUERY_CONTRACT.
import { z } from 'zod';
import type { MoreInfo } from '../../src/domain/more-info';
import { SCHEDULE_DAYS } from '../../src/domain/schedule';
import type { AnimeStatistics, MangaStatistics, UserStatistics } from '../../src/domain/user';
import type { Favorite, Favorites } from '../../src/domain/user-favorites';
import type { UserUpdate, UserUpdates } from '../../src/domain/user-updates';
import * as animeDetail from '../../src/parsers/anime-detail.parser';
import * as animeFull from '../../src/parsers/anime-full.parser';
import * as castStaff from '../../src/parsers/characters-staff.parser';
import * as charDetail from '../../src/parsers/character-detail.parser';
import * as charMedia from '../../src/parsers/character-media.parser';
import * as charSearch from '../../src/parsers/character-search.parser';
import * as clubDetail from '../../src/parsers/club-detail.parser';
import * as clubList from '../../src/parsers/club-list.parser';
import * as clubMembers from '../../src/parsers/club-members.parser';
import * as clubRelations from '../../src/parsers/club-relations.parser';
import * as episodeDetail from '../../src/parsers/episode-detail.parser';
import * as episodes from '../../src/parsers/episodes.parser';
import * as forum from '../../src/parsers/forum.parser';
import * as genres from '../../src/parsers/genre-taxonomy.parser';
import * as magazines from '../../src/parsers/magazines.parser';
import * as mangaDetail from '../../src/parsers/manga-detail.parser';
import * as news from '../../src/parsers/news.parser';
import * as personDetail from '../../src/parsers/person-detail.parser';
import * as personMedia from '../../src/parsers/person-media.parser';
import * as personSearch from '../../src/parsers/person-search.parser';
import * as pictures from '../../src/parsers/pictures.parser';
import * as producerDetail from '../../src/parsers/producer-detail.parser';
import * as producerFull from '../../src/parsers/producer-full.parser';
import * as producersList from '../../src/parsers/producers-list.parser';
import * as recs from '../../src/parsers/recommendations.parser';
import * as reviews from '../../src/parsers/reviews.parser';
import * as search from '../../src/parsers/search.parser';
import * as seasonArchive from '../../src/parsers/season-archive.parser';
import * as seasonNow from '../../src/parsers/season-now.parser';
import * as stats from '../../src/parsers/statistics.parser';
import * as titleRecs from '../../src/parsers/title-recommendations.parser';
import * as titleReviews from '../../src/parsers/title-reviews.parser';
import * as titleUpdates from '../../src/parsers/title-userupdates.parser';
import * as topChars from '../../src/parsers/top-characters.parser';
import * as topAnime from '../../src/parsers/top-anime.parser';
import * as topManga from '../../src/parsers/top-manga.parser';
import * as topPeople from '../../src/parsers/top-people.parser';
import * as userClubs from '../../src/parsers/user-clubs.parser';
import * as userFriends from '../../src/parsers/user-friends.parser';
import * as userList from '../../src/parsers/user-list.parser';
import * as userProfile from '../../src/parsers/user-profile.parser';
import * as userSearch from '../../src/parsers/user-search.parser';
import * as videos from '../../src/parsers/videos.parser';
import * as watchEpisodes from '../../src/parsers/watch-episodes.parser';
import * as watchPromos from '../../src/parsers/watch-promos.parser';

// The shapes no parser validates: the profile statistics, favourites and updates are assembled from
// several regexes without a zod pass, and `moreinfo` is a single text field.
const animeStatistics = z.object({
  watching: z.number(),
  completed: z.number(),
  onHold: z.number(),
  dropped: z.number(),
  planToWatch: z.number(),
  totalEntries: z.number(),
  rewatched: z.number().nullable(),
  episodesWatched: z.number().nullable(),
  daysWatched: z.number().nullable(),
  meanScore: z.number().nullable(),
}) satisfies z.ZodType<AnimeStatistics>;
const mangaStatistics = z.object({
  reading: z.number(),
  completed: z.number(),
  onHold: z.number(),
  dropped: z.number(),
  planToRead: z.number(),
  totalEntries: z.number(),
  reread: z.number().nullable(),
  chaptersRead: z.number().nullable(),
  volumesRead: z.number().nullable(),
  daysRead: z.number().nullable(),
  meanScore: z.number().nullable(),
}) satisfies z.ZodType<MangaStatistics>;
const userStatistics = z.object({ anime: animeStatistics, manga: mangaStatistics }) satisfies z.ZodType<UserStatistics>;

const favorite = z.object({
  malId: z.number().int(),
  title: z.string().optional(),
  name: z.string().optional(),
  url: z.string(),
  type: z.string().optional(),
  startYear: z.number().nullable().optional(),
  imageUrl: z.string().nullable(),
}) satisfies z.ZodType<Favorite>;
const favorites = z.object({
  anime: z.array(favorite),
  manga: z.array(favorite),
  characters: z.array(favorite),
  people: z.array(favorite),
}) satisfies z.ZodType<Favorites>;

const userUpdate = z.object({
  entry: z.object({ malId: z.number().int(), title: z.string(), imageUrl: z.string().nullable() }),
  score: z.number().nullable(),
  status: z.string(),
  progress: z.number().nullable(),
  total: z.number().nullable(),
  date: z.string(),
}) satisfies z.ZodType<UserUpdate>;
const userUpdates = z.object({
  anime: z.array(userUpdate),
  manga: z.array(userUpdate),
}) satisfies z.ZodType<UserUpdates>;

const moreInfo = z.object({ text: z.string().nullable() }) satisfies z.ZodType<MoreInfo>;

// The season routes add `continuing` after the card parser has run (it depends on where the card
// sits on the page, not on the card), so their entry is the card plus that flag.
const seasonEntry = seasonNow.entrySchema.extend({ continuing: z.boolean() });

const list = (schema: z.ZodTypeAny) => z.array(schema);

export const HEALTH_DATA = z.object({
  status: z.literal('ok'),
  service: z.literal('jikan-edge'),
  checks: z.object({ database: z.enum(['ok', 'not_configured', 'not_migrated', 'unavailable']) }),
});

export const ROUTE_DATA: Record<string, z.ZodTypeAny> = {
  '/v1/users': list(userSearch.entrySchema),
  '/v1/users/:username': userProfile.profileSchema,
  '/v1/users/:username/statistics': userStatistics,
  '/v1/users/:username/favorites': favorites,
  '/v1/users/:username/userupdates': userUpdates,
  '/v1/users/:username/full': z.object({
    profile: userProfile.profileSchema,
    statistics: userStatistics,
    favorites,
    updates: userUpdates,
  }),
  '/v1/users/:username/about': userProfile.profileSchema.pick({ about: true }),
  '/v1/users/:username/friends': list(userFriends.friendSchema),
  '/v1/users/:username/clubs': list(userClubs.clubSchema),
  '/v1/users/:username/reviews': list(reviews.entrySchema),
  '/v1/users/:username/recommendations': list(recs.entrySchema),
  '/v1/users/:username/animelist': list(userList.entrySchema),
  '/v1/users/:username/mangalist': list(userList.entrySchema),

  '/v1/anime': list(search.animeSchema),
  '/v1/anime/:id': animeDetail.animeDetailSchema,
  '/v1/anime/:id/full': animeDetail.animeDetailSchema.extend({ themeSongs: animeFull.themeSongsSchema }),
  '/v1/anime/:id/relations': list(animeDetail.relationSchema),
  '/v1/anime/:id/external': list(animeDetail.externalLinkSchema),
  '/v1/anime/:id/streaming': list(animeDetail.streamingSchema),
  '/v1/anime/:id/characters': list(castStaff.characterSchema),
  '/v1/anime/:id/staff': list(castStaff.staffSchema),
  '/v1/anime/:id/statistics': stats.statisticsSchema,
  '/v1/anime/:id/pictures': list(pictures.pictureSchema),
  '/v1/anime/:id/news': list(news.newsSchema),
  '/v1/anime/:id/forum': list(forum.threadSchema),
  '/v1/anime/:id/episodes': list(episodes.episodeSchema),
  '/v1/anime/:id/episodes/:episode': episodeDetail.schema,
  '/v1/anime/:id/videos': z.object({
    promos: z.array(videos.promoSchema),
    musicVideos: z.array(videos.promoSchema),
    episodes: z.array(videos.episodeSchema),
  }),
  '/v1/anime/:id/videos/episodes': list(videos.episodeSchema),
  '/v1/anime/:id/recommendations': list(titleRecs.entrySchema),
  '/v1/anime/:id/reviews': list(titleReviews.entrySchema),
  '/v1/anime/:id/userupdates': list(titleUpdates.schema),
  '/v1/anime/:id/themes': animeFull.themeSongsSchema,
  '/v1/anime/:id/moreinfo': moreInfo,

  '/v1/manga': list(search.mangaSchema),
  '/v1/manga/:id': mangaDetail.mangaDetailSchema,
  '/v1/manga/:id/full': mangaDetail.mangaDetailSchema,
  '/v1/manga/:id/relations': list(mangaDetail.relationSchema),
  '/v1/manga/:id/external': list(mangaDetail.externalLinkSchema),
  '/v1/manga/:id/characters': list(castStaff.characterSchema),
  '/v1/manga/:id/statistics': stats.statisticsSchema,
  '/v1/manga/:id/pictures': list(pictures.pictureSchema),
  '/v1/manga/:id/news': list(news.newsSchema),
  '/v1/manga/:id/forum': list(forum.threadSchema),
  '/v1/manga/:id/recommendations': list(titleRecs.entrySchema),
  '/v1/manga/:id/reviews': list(titleReviews.entrySchema),
  '/v1/manga/:id/userupdates': list(titleUpdates.schema),
  '/v1/manga/:id/moreinfo': moreInfo,

  '/v1/characters': list(charSearch.entrySchema),
  '/v1/characters/:id': charDetail.characterDetailSchema,
  '/v1/characters/:id/full': charDetail.characterDetailSchema.extend({
    anime: z.array(charMedia.mediaSchema),
    manga: z.array(charMedia.mediaSchema),
    voices: z.array(charMedia.voiceActorSchema),
  }),
  '/v1/characters/:id/anime': list(charMedia.mediaSchema),
  '/v1/characters/:id/manga': list(charMedia.mediaSchema),
  '/v1/characters/:id/voices': list(charMedia.voiceActorSchema),
  '/v1/characters/:id/pictures': list(pictures.pictureSchema),

  '/v1/people': list(personSearch.entrySchema),
  '/v1/people/:id': personDetail.personDetailSchema,
  '/v1/people/:id/full': personDetail.personDetailSchema.extend({
    anime: z.array(personMedia.staffSchema),
    manga: z.array(personMedia.mangaSchema),
    voices: z.array(personMedia.voiceSchema),
  }),
  '/v1/people/:id/anime': list(personMedia.staffSchema),
  '/v1/people/:id/manga': list(personMedia.mangaSchema),
  '/v1/people/:id/voices': list(personMedia.voiceSchema),
  '/v1/people/:id/pictures': list(pictures.pictureSchema),
  '/v1/people/:id/news': list(news.newsSchema),

  '/v1/producers': list(producersList.entrySchema),
  '/v1/producers/:id': producerDetail.producerDetailSchema,
  '/v1/producers/:id/full': producerDetail.producerDetailSchema.merge(producerFull.extraSchema),
  '/v1/producers/:id/external': producerFull.extraSchema.shape.external,
  '/v1/clubs': list(clubList.entrySchema),
  '/v1/clubs/:id': clubDetail.clubDetailSchema,
  '/v1/clubs/:id/staff': list(clubDetail.staffMemberSchema),
  '/v1/clubs/:id/relations': z.object({
    anime: z.array(clubRelations.titleSchema),
    manga: z.array(clubRelations.titleSchema),
    characters: z.array(clubRelations.charSchema),
  }),
  '/v1/clubs/:id/members': list(clubMembers.memberSchema),
  '/v1/magazines': list(magazines.magazineSchema),

  '/v1/top/anime': list(topAnime.entrySchema),
  '/v1/top/manga': list(topManga.entrySchema),
  '/v1/top/characters': list(topChars.entrySchema),
  '/v1/top/people': list(topPeople.entrySchema),
  '/v1/genres/anime': list(genres.entrySchema),
  '/v1/genres/manga': list(genres.entrySchema),
  '/v1/seasons': list(seasonArchive.entrySchema),
  '/v1/seasons/now': list(seasonEntry),
  '/v1/seasons/upcoming': list(seasonEntry),
  '/v1/seasons/:year/:season': list(seasonEntry),
  // Keyed by day without `?filter=`, one day's list with it.
  '/v1/schedules': z.union([
    z.object(Object.fromEntries(SCHEDULE_DAYS.map((day) => [day, z.array(seasonNow.entrySchema)]))),
    z.array(seasonNow.entrySchema),
  ]),

  '/v1/watch/episodes': list(watchEpisodes.entrySchema),
  '/v1/watch/episodes/popular': list(watchEpisodes.entrySchema),
  '/v1/watch/promos': list(watchPromos.entrySchema),
  '/v1/watch/promos/popular': list(watchPromos.entrySchema),
  '/v1/recommendations/anime': list(recs.entrySchema),
  '/v1/recommendations/manga': list(recs.entrySchema),
  '/v1/reviews/anime': list(reviews.entrySchema),
  '/v1/reviews/manga': list(reviews.entrySchema),
  // A random pick is a stored detail payload, drawn straight from the typed table it came from.
  '/v1/random/anime': animeDetail.animeDetailSchema,
  '/v1/random/manga': mangaDetail.mangaDetailSchema,
  '/v1/random/characters': charDetail.characterDetailSchema,
  '/v1/random/people': personDetail.personDetailSchema,
  '/v1/random/users': userProfile.profileSchema,
};
