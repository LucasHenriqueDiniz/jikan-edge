import type { ForumThread } from '../../domain/forum';
import type { Magazine } from '../../domain/magazine';
import type { MoreInfo } from '../../domain/more-info';
import type { NewsItem } from '../../domain/news';
import type { Picture } from '../../domain/picture';
import type { RecommendationEntry } from '../../domain/recommendation';
import type { ReviewEntry } from '../../domain/review';
import type { EntryStatistics } from '../../domain/statistics';
import type { TitleRecommendation } from '../../domain/title-recommendation';
import type { TitleReview } from '../../domain/title-review';
import type { WatchEpisodeEntry, WatchPromoEntry } from '../../domain/watch';
import { entity, images, malUrl, trailer } from './primitives';

export function pictures(rows: Picture[]) {
  return rows.map((p) => images(p.imageUrl, p.thumbnailUrl));
}

export function news(rows: NewsItem[]) {
  return rows.map((n) => ({
    mal_id: n.malId,
    url: n.url,
    title: n.title,
    date: n.date,
    author_username: n.author,
    author_url: n.author ? `https://myanimelist.net/profile/${n.author}` : null,
    forum_url: n.url,
    images: images(n.imageUrl),
    comments: null,
    excerpt: n.excerpt,
  }));
}

export function forum(rows: ForumThread[]) {
  return rows.map((t) => ({
    mal_id: t.topicId,
    url: `https://myanimelist.net/forum/?topicid=${t.topicId}`,
    title: t.title,
    date: t.startedDate,
    author_username: t.startedBy,
    author_url: t.startedBy ? `https://myanimelist.net/profile/${t.startedBy}` : null,
    comments: t.replies,
    last_comment: { url: null, author_username: t.lastPostBy, author_url: t.lastPostBy ? `https://myanimelist.net/profile/${t.lastPostBy}` : null, date: null },
  }));
}

export function moreInfo(info: MoreInfo) {
  return { moreinfo: info.text };
}

export function statistics(s: EntryStatistics, type: 'anime' | 'manga') {
  const progress = type === 'anime' ? { watching: s.status.inProgress, plan_to_watch: s.status.planned } : { reading: s.status.inProgress, plan_to_read: s.status.planned };
  return {
    ...progress,
    completed: s.status.completed,
    on_hold: s.status.onHold,
    dropped: s.status.dropped,
    total: s.status.total,
    scores: s.scores.map((row) => ({ score: row.score, votes: row.votes, percentage: row.percentage })),
  };
}

/**
 * `/reviews/anime|manga` and `/users/:u/reviews` — the feeds where each review links back to its
 * title. The media type comes from the row, not the route: a user's review feed mixes both.
 */
export function reviews(rows: ReviewEntry[]) {
  return rows.map((r) => ({
    mal_id: r.malId,
    url: malUrl(r.type, r.malId),
    type: r.type,
    date: r.date,
    review: r.reviewText,
    score: r.score,
    tags: r.tag ? [r.tag] : [],
    is_spoiler: null,
    is_preliminary: null,
    user: r.username ? { username: r.username, url: `https://myanimelist.net/profile/${r.username}`, images: images(null) } : null,
    entry: { mal_id: r.malId, url: malUrl(r.type, r.malId), images: images(r.imageUrl), title: r.title },
  }));
}

/**
 * `/anime|manga/:id/reviews` — the per-title feed. Deliberately not the mapper above: these rows
 * carry no back-link to the title (you already know it from the path), so reusing the global
 * mapper would emit an `entry` built from fields that aren't there.
 */
export function titleReviews(rows: TitleReview[]) {
  return rows.map((r) => ({
    mal_id: null,
    url: null,
    date: r.date,
    review: r.reviewText,
    score: r.score,
    tags: r.tag ? [r.tag] : [],
    is_spoiler: null,
    is_preliminary: null,
    user: r.username ? { username: r.username, url: `https://myanimelist.net/profile/${r.username}`, images: images(r.imageUrl) } : null,
  }));
}

/** `/recommendations/anime|manga` — the global feed, where both sides of the pair are present. */
export function recommendations(rows: RecommendationEntry[]) {
  return rows.map((r) => ({
    mal_id: `${r.malId}-${r.recommendedMalId}`,
    entry: [
      { mal_id: r.malId, url: malUrl(r.type, r.malId), images: images(r.imageUrl), title: r.title },
      { mal_id: r.recommendedMalId, url: malUrl(r.type, r.recommendedMalId), images: images(r.recommendedImageUrl), title: r.recommendedTitle },
    ],
    content: r.content,
    user: r.username ? { url: `https://myanimelist.net/profile/${r.username}`, username: r.username } : null,
  }));
}

/** `/anime|manga/:id/recommendations` — only the recommended side exists in these rows. */
export function titleRecommendations(rows: TitleRecommendation[], type: 'anime' | 'manga') {
  return rows.map((r) => ({
    entry: { mal_id: r.malId, url: malUrl(type, r.malId), images: images(r.imageUrl), title: r.title },
    url: malUrl(type, r.malId),
    votes: r.votes,
  }));
}

export function magazines(rows: Magazine[]) {
  return rows.map((m) => ({ mal_id: m.malId, name: m.name, url: m.url, count: m.count }));
}

export function watchEpisodes(rows: WatchEpisodeEntry[]) {
  return rows.map((row) => ({
    entry: { mal_id: row.animeId, url: malUrl('anime', row.animeId), images: images(row.imageUrl), title: row.animeTitle },
    episodes: row.episodes.map((title) => ({ mal_id: null, url: null, title, premium: null })),
    region_locked: null,
  }));
}

export function watchPromos(rows: WatchPromoEntry[]) {
  return rows.map((row) => ({
    title: row.title,
    entry: { mal_id: row.animeId, url: malUrl('anime', row.animeId), images: images(row.imageUrl), title: row.animeTitle },
    trailer: trailer(row.videoUrl, row.imageUrl),
  }));
}

export { entity };
