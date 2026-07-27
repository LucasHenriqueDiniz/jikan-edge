CREATE TABLE IF NOT EXISTS user_updates (username_key TEXT PRIMARY KEY, payload_json TEXT NOT NULL, fetched_at TEXT NOT NULL, parser_version TEXT NOT NULL);
