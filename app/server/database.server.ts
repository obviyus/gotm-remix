import { createClient } from "@libsql/client";
export const db = createClient({
	url: Bun.env.TURSO_DATABASE_URL ?? "",
	authToken: Bun.env.TURSO_AUTH_TOKEN,
});

// Run migrations
await db.execute(`
CREATE TABLE IF NOT EXISTS igdb_releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  release_date TEXT NOT NULL,
  game_id INTEGER NOT NULL,
  game_name TEXT NOT NULL,
  game_cover TEXT,
  game_summary TEXT,
  game_year TEXT,
  game_url TEXT,
  popularity_score INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE (release_date, game_id)
)`);

await db.execute(`CREATE INDEX IF NOT EXISTS idx_igdb_releases_date ON igdb_releases(release_date)`);
