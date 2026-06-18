import { createClient } from "@libsql/client";
import { getDatabaseConfig } from "~/server/database-config.server";

export const db = createClient(getDatabaseConfig());

await db.batch(
	[
		`CREATE TABLE IF NOT EXISTS igdb_releases (
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
		)`,
		`WITH vote_rank_stats AS (
			SELECT
				v.id,
				v.month_id,
				v.discord_id,
				v.short,
				COALESCE(MAX(r.updated_at), MAX(r.created_at), v.updated_at, v.created_at, 0) AS last_activity_time,
				COUNT(r.id) AS ranking_count
			FROM votes v
			LEFT JOIN rankings r ON r.vote_id = v.id
			GROUP BY v.id, v.month_id, v.discord_id, v.short, v.updated_at, v.created_at
		),
		duplicate_votes AS (
			SELECT
				id,
				ROW_NUMBER() OVER (
					PARTITION BY month_id, discord_id, short
					ORDER BY last_activity_time DESC, ranking_count DESC, id DESC
				) AS row_number
			FROM vote_rank_stats
		)
		DELETE FROM votes
		WHERE id IN (
			SELECT id
			FROM duplicate_votes
			WHERE row_number > 1
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_month_discord_short_unique
		 ON votes(month_id, discord_id, short)`,
		`CREATE INDEX IF NOT EXISTS idx_votes_month_short
		 ON votes(month_id, short)`,
		`CREATE INDEX IF NOT EXISTS idx_nominations_month_jury_short_name
		 ON nominations(month_id, jury_selected, short, game_name)`,
		`CREATE INDEX IF NOT EXISTS idx_igdb_releases_date
		 ON igdb_releases(release_date)`,
		`CREATE INDEX IF NOT EXISTS idx_igdb_releases_date_popularity
		 ON igdb_releases(release_date, popularity_score DESC)`,
	],
	"write",
);

const monthColumns = new Set(
	(await db.execute("PRAGMA table_info(months)")).rows.map((row) => String(row.name)),
);
const monthLabelMigrations: string[] = [];

if (!monthColumns.has("long_label")) {
	monthLabelMigrations.push(
		"ALTER TABLE months ADD COLUMN long_label TEXT NOT NULL DEFAULT 'Long'",
	);
}

if (!monthColumns.has("short_label")) {
	monthLabelMigrations.push(
		"ALTER TABLE months ADD COLUMN short_label TEXT NOT NULL DEFAULT 'Short'",
	);
}

if (monthLabelMigrations.length > 0) {
	await db.batch(monthLabelMigrations, "write");
}
