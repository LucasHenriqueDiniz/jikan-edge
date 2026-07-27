CREATE TABLE IF NOT EXISTS producers (mal_id INTEGER PRIMARY KEY, name TEXT NOT NULL, payload_json TEXT NOT NULL, fetched_at TEXT NOT NULL, parser_version TEXT NOT NULL);
