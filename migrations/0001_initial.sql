CREATE TABLE IF NOT EXISTS users (
  username_key TEXT PRIMARY KEY,
  canonical_username TEXT NOT NULL,
  profile_url TEXT NOT NULL,
  avatar_url TEXT,
  about TEXT,
  gender TEXT,
  location TEXT,
  birthday TEXT,
  joined_at TEXT,
  last_online_at TEXT,
  fetched_at TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  source_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_statistics (
  username_key TEXT PRIMARY KEY REFERENCES users(username_key) ON DELETE CASCADE,
  anime_json TEXT NOT NULL,
  manga_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  parser_version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_media_list_entries (
  username_key TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('anime', 'manga')),
  mal_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  status TEXT,
  score REAL,
  progress INTEGER,
  total INTEGER,
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT,
  fetched_at TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  PRIMARY KEY (username_key, media_type, mal_id)
);
CREATE INDEX IF NOT EXISTS idx_user_media_entries_page ON user_media_list_entries(username_key, media_type, title);
CREATE INDEX IF NOT EXISTS idx_user_media_entries_mal_id ON user_media_list_entries(mal_id);

CREATE TABLE IF NOT EXISTS anime (
  mal_id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  parser_version TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS manga (
  mal_id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  parser_version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cache_entries (
  resource_key TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  source_status TEXT NOT NULL,
  parser_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cache_entries_expiry ON cache_entries(expires_at);

CREATE TABLE IF NOT EXISTS refresh_leases (
  resource_key TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_leases_expiry ON refresh_leases(expires_at);

CREATE TABLE IF NOT EXISTS source_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  status INTEGER,
  detail TEXT,
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_source_failures_resource_time ON source_failures(resource_key, occurred_at);
