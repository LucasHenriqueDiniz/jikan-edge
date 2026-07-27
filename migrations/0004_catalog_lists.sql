CREATE TABLE IF NOT EXISTS catalog_lists (resource_key TEXT PRIMARY KEY, payload_json TEXT NOT NULL, fetched_at TEXT NOT NULL, parser_version TEXT NOT NULL);
