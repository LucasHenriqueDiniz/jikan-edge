import type { MediaType, UserMediaListEntry } from '../domain/list-entry';
import type { UserProfile, UserStatistics } from '../domain/user';

export class UserRepository {
  constructor(private readonly db: D1Database) {}

  async getProfile(key: string): Promise<UserProfile | null> {
    const row = await this.db.prepare('SELECT * FROM users WHERE username_key = ?').bind(key).first<Record<string, string | null>>();
    if (!row) return null;
    return { username: row.username_key!, canonicalUsername: row.canonical_username!, profileUrl: row.profile_url!, avatarUrl: row.avatar_url, about: row.about, gender: row.gender, location: row.location, birthday: row.birthday, joinedAt: row.joined_at, lastOnlineAt: row.last_online_at, fetchedAt: row.fetched_at!, sourceVersion: row.parser_version! };
  }

  async getStatistics(key: string): Promise<UserStatistics | null> {
    const row = await this.db.prepare('SELECT anime_json, manga_json FROM user_statistics WHERE username_key = ?').bind(key).first<{ anime_json: string; manga_json: string }>();
    return row ? { anime: JSON.parse(row.anime_json), manga: JSON.parse(row.manga_json) } : null;
  }

  async saveProfile(profile: UserProfile, stats: UserStatistics): Promise<void> {
    const key = profile.username.toLowerCase();
    await this.db.batch([
      this.db.prepare(`INSERT INTO users(username_key, canonical_username, profile_url, avatar_url, about, gender, location, birthday, joined_at, last_online_at, fetched_at, parser_version, source_status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(username_key) DO UPDATE SET canonical_username=excluded.canonical_username, profile_url=excluded.profile_url, avatar_url=excluded.avatar_url, about=excluded.about, gender=excluded.gender, location=excluded.location, birthday=excluded.birthday, joined_at=excluded.joined_at, last_online_at=excluded.last_online_at, fetched_at=excluded.fetched_at, parser_version=excluded.parser_version, source_status=excluded.source_status`)
        .bind(key, profile.canonicalUsername, profile.profileUrl, profile.avatarUrl, profile.about, profile.gender, profile.location, profile.birthday, profile.joinedAt, profile.lastOnlineAt, profile.fetchedAt, profile.sourceVersion, 'success'),
      this.db.prepare(`INSERT INTO user_statistics(username_key, anime_json, manga_json, fetched_at, parser_version) VALUES(?,?,?,?,?)
        ON CONFLICT(username_key) DO UPDATE SET anime_json=excluded.anime_json, manga_json=excluded.manga_json, fetched_at=excluded.fetched_at, parser_version=excluded.parser_version`)
        .bind(key, JSON.stringify(stats.anime), JSON.stringify(stats.manga), profile.fetchedAt, profile.sourceVersion),
    ]);
  }

  async replaceList(key: string, mediaType: MediaType, entries: UserMediaListEntry[]): Promise<void> {
    const statements: D1PreparedStatement[] = [this.db.prepare('DELETE FROM user_media_list_entries WHERE username_key = ? AND media_type = ?').bind(key, mediaType)];
    for (const entry of entries) statements.push(this.db.prepare(`INSERT INTO user_media_list_entries(username_key, media_type, mal_id, title, image_url, status, score, progress, total, started_at, finished_at, updated_at, fetched_at, parser_version)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(key, mediaType, entry.malId, entry.title, entry.imageUrl, entry.status, entry.score, entry.progress, entry.total, entry.startedAt, entry.finishedAt, entry.updatedAt, entry.fetchedAt, entry.sourceVersion));
    await this.db.batch(statements);
  }

  async listEntries(key: string, mediaType: MediaType, page: number, limit: number): Promise<{ entries: UserMediaListEntry[]; total: number }> {
    const offset = (page - 1) * limit;
    const [count, rows] = await this.db.batch([
      this.db.prepare('SELECT COUNT(*) AS total FROM user_media_list_entries WHERE username_key = ? AND media_type = ?').bind(key, mediaType),
      this.db.prepare('SELECT * FROM user_media_list_entries WHERE username_key = ? AND media_type = ? ORDER BY title LIMIT ? OFFSET ?').bind(key, mediaType, limit, offset),
    ]);
    const total = Number((count.results[0] as { total: number } | undefined)?.total ?? 0);
    const entries = rows.results.map((row) => {
      const item = row as unknown as Record<string, string | number | null>;
      return { username: key, mediaType, malId: Number(item.mal_id), title: String(item.title), imageUrl: item.image_url as string | null, status: item.status as string | null, score: item.score === null ? null : Number(item.score), progress: item.progress === null ? null : Number(item.progress), total: item.total === null ? null : Number(item.total), startedAt: item.started_at as string | null, finishedAt: item.finished_at as string | null, updatedAt: item.updated_at as string | null, fetchedAt: String(item.fetched_at), sourceVersion: String(item.parser_version) };
    });
    return { entries, total };
  }
}
