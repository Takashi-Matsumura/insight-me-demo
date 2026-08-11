PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id             TEXT PRIMARY KEY,
  student_name   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active',   -- active | completed | abandoned
  current_theme  TEXT NOT NULL DEFAULT 'flow',
  probe_count    INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  theme_id    TEXT NOT NULL,
  role        TEXT NOT NULL,                       -- user | assistant
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);

CREATE TABLE IF NOT EXISTS theme_results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  theme_id    TEXT NOT NULL,
  skipped     INTEGER NOT NULL DEFAULT 0,
  quote       TEXT,
  label       TEXT,
  reframe     TEXT,
  summary     TEXT,
  tags_json   TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, theme_id)
);

CREATE TABLE IF NOT EXISTS reports (
  session_id     TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  profile_md     TEXT NOT NULL,
  strengths_json TEXT NOT NULL DEFAULT '[]',
  values_json    TEXT NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'partial',   -- partial | complete
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS career_matches (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  career_id    TEXT NOT NULL,
  rank         INTEGER NOT NULL,
  fit_score    INTEGER NOT NULL,
  is_discovery INTEGER NOT NULL DEFAULT 0,
  reason       TEXT,
  next_step    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, career_id)
);
CREATE INDEX IF NOT EXISTS idx_matches_session ON career_matches(session_id, rank);

-- ダイアログの「あなたの力が活きるところ」をAIに書かせた結果のキャッシュ。
-- career_matches（おすすめ6件専用・listCareerMatches が全件返す前提）とは
-- 意図的に分離する。ここには最大70件/セッション入りうる。
CREATE TABLE IF NOT EXISTS career_fits (
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  career_id   TEXT NOT NULL,
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (session_id, career_id)
);
