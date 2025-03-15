CREATE TABLE IF NOT EXISTS igdb_platforms (
  igdb_id INTEGER PRIMARY KEY,
  name TEXT,
  logo TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS jury_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT 1 NOT NULL,
  is_admin BOOLEAN DEFAULT 0 NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration TEXT NOT NULL,
  batch INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS theme_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (theme_category_id) REFERENCES theme_categories (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS month_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS months (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id INTEGER,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status_id INTEGER DEFAULT 1 NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE (year, month),
  FOREIGN KEY (theme_id) REFERENCES themes (id) ON UPDATE CASCADE ON DELETE
  SET
    NULL,
    FOREIGN KEY (status_id) REFERENCES month_status (id)
);

CREATE TABLE IF NOT EXISTS nominations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_id INTEGER,
  game_id INTEGER NOT NULL,
  discord_id TEXT NOT NULL,
  short BOOLEAN,
  game_name TEXT NOT NULL,
  game_year TEXT,
  game_cover TEXT,
  game_url TEXT,
  jury_selected BOOLEAN DEFAULT 0 NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE (month_id, game_id),
  FOREIGN KEY (month_id) REFERENCES months (id) ON UPDATE CASCADE ON DELETE
  SET
    NULL
);

CREATE TABLE IF NOT EXISTS nomination_platforms (
  nomination_id INTEGER NOT NULL,
  platform_id INTEGER NOT NULL,
  PRIMARY KEY (nomination_id, platform_id),
  FOREIGN KEY (nomination_id) REFERENCES nominations(id) ON DELETE CASCADE,
  FOREIGN KEY (platform_id) REFERENCES igdb_platforms(igdb_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pitches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomination_id INTEGER,
  discord_id TEXT NOT NULL,
  pitch TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE (nomination_id, discord_id),
  FOREIGN KEY (nomination_id) REFERENCES nominations (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_id INTEGER,
  discord_id TEXT NOT NULL,
  short BOOLEAN,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (month_id) REFERENCES months (id) ON UPDATE CASCADE ON DELETE
  SET
    NULL
);

CREATE TABLE IF NOT EXISTS rankings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vote_id INTEGER NOT NULL,
  nomination_id INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE (vote_id, rank),
  FOREIGN KEY (nomination_id) REFERENCES nominations (id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (vote_id) REFERENCES votes (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS winners (
  game_id INTEGER PRIMARY KEY,
  month_id INTEGER,
  nomination_id INTEGER,
  short BOOLEAN,
  game_name TEXT NOT NULL,
  game_year TEXT,
  game_cover TEXT,
  game_url TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (month_id) REFERENCES months (id) ON UPDATE CASCADE ON DELETE
  SET
    NULL,
    FOREIGN KEY (nomination_id) REFERENCES nominations (id) ON UPDATE CASCADE ON DELETE
  SET
    NULL
);

CREATE INDEX IF NOT EXISTS idx_themes_theme_category_id ON themes(theme_category_id);

CREATE INDEX IF NOT EXISTS idx_months_theme_id ON months(theme_id);

CREATE INDEX IF NOT EXISTS idx_nominations_month_id ON nominations(month_id);

CREATE INDEX IF NOT EXISTS idx_pitches_nomination_id ON pitches(nomination_id);

CREATE INDEX IF NOT EXISTS idx_votes_month_id ON votes(month_id);

CREATE INDEX IF NOT EXISTS idx_rankings_vote_id ON rankings(vote_id);

CREATE INDEX IF NOT EXISTS idx_rankings_nomination_id ON rankings(nomination_id);

CREATE INDEX IF NOT EXISTS idx_winners_month_id ON winners(month_id);

CREATE INDEX IF NOT EXISTS idx_winners_nomination_id ON winners(nomination_id);