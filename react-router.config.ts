import type { Config } from "@react-router/dev/config";

export default {
	ssr: true,
	async prerender() {
		// If DB env is not available at build time, skip dynamic paths to avoid failing CI builds
		if (!process.env.TURSO_DATABASE_URL) {
			return ["/history"]; // allow base history page to build without DB
		}

		// Lazy import to avoid initializing the DB client at module load when env is missing
		const { db } = await import("./app/server/database.server");

		// Get all month IDs that have completed phases (not in nominating status)
		const result = await db.execute(
			`SELECT id FROM months WHERE status_id NOT IN (
				SELECT id FROM month_status WHERE status = 'nominating'
			);`,
		);

		const historyPaths = [
			"/history", // Main history page
			...result.rows.map((row) => `/history/${row.id}`), // Individual month pages
		];

		return historyPaths;
	},
} satisfies Config;
