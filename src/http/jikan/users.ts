import type { UserMediaListEntry } from '../../domain/list-entry';
import type { TitleUserUpdate } from '../../domain/title-userupdates';
import type { UserSearchResult } from '../../domain/user-search';
import type { UserClub, UserFriend } from '../../domain/user-social';
import type { UserProfile, UserStatistics } from '../../domain/user';
import type { Favorite, Favorites } from '../../parsers/user-favorites.parser';
import type { UserUpdate, UserUpdates } from '../../parsers/user-updates.parser';
import { images, malUrl } from './primitives';

export function userProfile(d: UserProfile) {
  return {
    mal_id: null,
    username: d.canonicalUsername,
    url: d.profileUrl,
    images: images(d.avatarUrl),
    last_online: d.lastOnlineAt,
    gender: d.gender,
    birthday: d.birthday,
    location: d.location,
    joined: d.joinedAt,
    about: d.about,
  };
}

export function userStatistics(s: UserStatistics) {
  return {
    anime: {
      days_watched: null,
      mean_score: s.anime.meanScore,
      watching: s.anime.watching,
      completed: s.anime.completed,
      on_hold: s.anime.onHold,
      dropped: s.anime.dropped,
      plan_to_watch: s.anime.planToWatch,
      total_entries: s.anime.totalEntries,
      rewatched: null,
      episodes_watched: s.anime.episodesWatched,
    },
    manga: {
      days_read: null,
      mean_score: s.manga.meanScore,
      reading: s.manga.reading,
      completed: s.manga.completed,
      on_hold: s.manga.onHold,
      dropped: s.manga.dropped,
      plan_to_read: s.manga.planToRead,
      total_entries: s.manga.totalEntries,
      reread: null,
      chapters_read: s.manga.chaptersRead,
      volumes_read: s.manga.volumesRead,
    },
  };
}

export function userMediaList(entries: UserMediaListEntry[]) {
  return entries.map((e) => ({
    [e.mediaType]: { mal_id: e.malId, url: malUrl(e.mediaType, e.malId), images: images(e.imageUrl), title: e.title },
    status: e.status,
    score: e.score,
    progress: e.progress,
    total: e.total,
    start_date: e.startedAt,
    finish_date: e.finishedAt,
    updated_at: e.updatedAt,
  }));
}

export function friends(rows: UserFriend[]) {
  return rows.map((row) => ({
    user: { username: row.username, url: `https://myanimelist.net/profile/${row.username}`, images: images(row.imageUrl) },
    last_online: row.lastOnline,
    friends_since: row.friendsSince,
  }));
}

export function clubs(rows: UserClub[]) {
  return rows.map((row) => ({ mal_id: row.malId, name: row.name, url: row.url }));
}

export function userSearch(rows: UserSearchResult[]) {
  return rows.map((row) => ({
    mal_id: null,
    username: row.username,
    url: row.url,
    images: images(row.avatarUrl),
    last_online: null,
    joined: row.joinedAt,
  }));
}

/** `/anime|manga/:id/userupdates` — public list activity, scraped from the title's stats page. */
export function titleUserUpdates(rows: TitleUserUpdate[]) {
  return rows.map((row) => ({
    user: { username: row.username, url: `https://myanimelist.net/profile/${row.username}`, images: images(row.imageUrl) },
    score: row.score,
    status: row.status,
    episodes_seen: row.progress,
    episodes_total: row.total,
    chapters_read: row.progress,
    chapters_total: row.total,
    date: row.date,
  }));
}

export function favorites(f: Favorites) {
  const media = (rows: Favorite[], type: 'anime' | 'manga') =>
    rows.map((row) => ({ mal_id: row.mal_id, url: row.url, images: images(row.imageUrl), title: row.title ?? '', type: row.type ?? type, start_year: null }));
  const named = (rows: Favorite[]) => rows.map((row) => ({ mal_id: row.mal_id, url: row.url, images: images(row.imageUrl), name: row.name ?? '' }));
  return { anime: media(f.anime, 'anime'), manga: media(f.manga, 'manga'), characters: named(f.characters), people: named(f.people) };
}

export function userUpdates(u: UserUpdates) {
  const rows = (list: UserUpdate[], type: 'anime' | 'manga') =>
    list.map((row) => ({
      entry: { mal_id: row.entry.mal_id, url: malUrl(type, row.entry.mal_id), images: images(row.entry.imageUrl), title: row.entry.title },
      score: row.score,
      status: row.status,
      ...(type === 'anime'
        ? { episodes_seen: row.progress, episodes_total: row.total }
        : { chapters_read: row.progress, chapters_total: row.total, volumes_read: null, volumes_total: null }),
      date: row.date,
    }));
  return { anime: rows(u.anime, 'anime'), manga: rows(u.manga, 'manga') };
}

export function fullProfile(p: { profile: UserProfile; statistics: UserStatistics; favorites: Favorites; updates: UserUpdates }) {
  return { ...userProfile(p.profile), statistics: userStatistics(p.statistics), favorites: favorites(p.favorites), updates: userUpdates(p.updates) };
}
